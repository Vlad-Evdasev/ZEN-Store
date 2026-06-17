import type { Request, Response, NextFunction } from "express";

// Простой guard для админ-эндпоинтов: сверяет заголовок x-admin-secret с
// ADMIN_SECRET из окружения. Совпадает по поведению с локальной проверкой
// в routes/admin.ts, вынесено в мидлвар для переиспользования.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const ADMIN_SECRET = process.env.ADMIN_SECRET || "";
  const secret = req.headers["x-admin-secret"] as string | undefined;
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
