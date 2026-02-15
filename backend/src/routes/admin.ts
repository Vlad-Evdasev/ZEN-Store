import { Router } from "express";

export const adminRouter = Router();

adminRouter.get("/verify", (req, res) => {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!ADMIN_SECRET) {
    return res.json({ ok: true });
  }
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.json({ ok: true });
});
