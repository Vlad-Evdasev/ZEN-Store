import { db } from "../db/schema.js";

/**
 * Wallet ledger — the single source of truth for user balances.
 *
 * The balance is never stored as a mutable number; it is the SUM of all
 * append-only proovки (entries) in `wallet_transactions`. Every credit or
 * debit is one entry. All amounts are integer fen (1 CNY = 100 fen).
 *
 * better-sqlite3 is synchronous and single-threaded, so `db.transaction`
 * gives us atomic read-modify-write without races. An optional
 * `idempotencyKey` (UNIQUE column) makes posting safe to retry — e.g. when a
 * payment webhook is delivered twice.
 */

export type WalletTxType =
  | "topup"
  | "order_payment"
  | "commission"
  | "cargo_fee"
  | "refund"
  | "adjustment";

export interface WalletTransaction {
  id: number;
  user_id: string;
  type: WalletTxType;
  amount_fen: number;
  balance_after_fen: number;
  ref_type: string | null;
  ref_id: number | null;
  idempotency_key: string | null;
  note: string | null;
  created_at: string;
}

export class LedgerError extends Error {
  code: "invalid_amount" | "insufficient_funds";
  constructor(code: LedgerError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "LedgerError";
  }
}

/** Current balance in fen (sum of all entries for the user). */
export function getBalanceFen(userId: string): number {
  const row = db
    .prepare("SELECT COALESCE(SUM(amount_fen), 0) AS bal FROM wallet_transactions WHERE user_id = ?")
    .get(userId) as { bal: number };
  return row.bal;
}

export interface PostEntryInput {
  userId: string;
  type: WalletTxType;
  /** Signed amount in fen: positive = credit, negative = debit. */
  amountFen: number;
  refType?: string | null;
  refId?: number | null;
  /** When set, a repeated post with the same key returns the original entry. */
  idempotencyKey?: string | null;
  note?: string | null;
  /** Allow the balance to go below zero (used for admin adjustments/refunds). */
  allowNegative?: boolean;
}

/**
 * Posts a single ledger entry atomically and returns it.
 * Throws LedgerError on a zero/non-integer amount or insufficient funds.
 */
export const postEntry = db.transaction((input: PostEntryInput): WalletTransaction => {
  const { userId, type, amountFen } = input;
  if (!Number.isInteger(amountFen) || amountFen === 0) {
    throw new LedgerError("invalid_amount", "amountFen must be a non-zero integer");
  }

  const key = input.idempotencyKey ?? null;
  if (key) {
    const existing = db
      .prepare("SELECT * FROM wallet_transactions WHERE idempotency_key = ?")
      .get(key) as WalletTransaction | undefined;
    if (existing) return existing; // idempotent: do not double-post
  }

  const current = getBalanceFen(userId);
  const next = current + amountFen;
  if (next < 0 && !input.allowNegative) {
    throw new LedgerError("insufficient_funds", "Insufficient wallet balance");
  }

  const info = db
    .prepare(
      `INSERT INTO wallet_transactions
         (user_id, type, amount_fen, balance_after_fen, ref_type, ref_id, idempotency_key, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(userId, type, amountFen, next, input.refType ?? null, input.refId ?? null, key, input.note ?? null);

  return db
    .prepare("SELECT * FROM wallet_transactions WHERE id = ?")
    .get(info.lastInsertRowid) as WalletTransaction;
});

/**
 * Total amount (positive fen) debited from the wallet for a given reference,
 * e.g. all charges of one cargo order. Used to compute refunds on cancel.
 */
export function sumDebitsForRef(refType: string, refId: number): number {
  const row = db
    .prepare(
      "SELECT COALESCE(-SUM(amount_fen), 0) AS total FROM wallet_transactions WHERE ref_type = ? AND ref_id = ? AND amount_fen < 0"
    )
    .get(refType, refId) as { total: number };
  return row.total;
}

/** Recent ledger entries for a user, newest first. */
export function listTransactions(userId: string, limit = 50): WalletTransaction[] {
  const lim = Math.min(Math.max(1, Math.floor(limit)), 200);
  return db
    .prepare("SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, lim) as WalletTransaction[];
}
