import { getAppSetting } from "../lib/appSettings.js";

/**
 * Payment-provider abstraction for wallet top-ups.
 *
 * Phase 1 ships only `ManualProvider`: the user is shown payment instructions
 * (card/phone from app_settings) and an operator confirms the transfer in the
 * admin panel, which credits the wallet. Later phases can register an
 * aggregator/API provider (auto-confirm via webhook) behind the same interface
 * without touching the routes or the ledger.
 */

export interface CreateTopupParams {
  topupId: number;
  userId: string;
  /** CNY to credit, in fen. */
  amountFen: number;
  /** Local currency to collect, in minor units (e.g. BYN kopecks). */
  amountLocal: number;
  localCurrency: string;
}

export interface TopupInstructions {
  provider: string;
  /** Human-readable instructions shown to the user. */
  instructions: string;
  /** Optional structured payee (card number / phone) the UI can highlight. */
  payTo: string | null;
  /** Provider's own reference for this top-up, if any. */
  providerRef: string | null;
  /** true = credited automatically (webhook); false = needs admin confirmation. */
  autoConfirm: boolean;
}

export interface PaymentProvider {
  readonly name: string;
  createTopup(params: CreateTopupParams): Promise<TopupInstructions>;
}

class ManualProvider implements PaymentProvider {
  readonly name = "manual";

  async createTopup(_params: CreateTopupParams): Promise<TopupInstructions> {
    const instructions =
      getAppSetting("topup_instructions") ||
      "Переведите указанную сумму на реквизиты и нажмите «Я оплатил».";
    const payTo = getAppSetting("topup_pay_to") || null;
    return {
      provider: this.name,
      instructions,
      payTo,
      providerRef: null,
      autoConfirm: false,
    };
  }
}

const providers: Record<string, PaymentProvider> = {
  manual: new ManualProvider(),
};

/** Returns the configured provider, falling back to manual. */
export function getProvider(name?: string | null): PaymentProvider {
  return providers[name || "manual"] ?? providers.manual;
}
