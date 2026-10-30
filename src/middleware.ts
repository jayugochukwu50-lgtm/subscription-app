import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

/**
 * Checks the request body against a Zod schema before the route runs.
 * On success the cleaned data (trimmed, lower-cased and so on) replaces the
 * original body. On failure the client gets a 400 with field-level messages.
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Protects admin routes with a shared key sent in the x-admin-key header.
 * The comparison is constant-time so response speed cannot reveal the key.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return res.status(500).json({ error: "Server not configured" });

  const given = Buffer.from(req.header("x-admin-key") ?? "");
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

/**
 * Last-resort error handler. Clients only ever see a safe message, and the
 * real error is logged on the server. Express recognises an error handler
 * by its four parameters, so _next must stay even though it is unused.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const message = err instanceof Error ? err.message : "";

  if (message.includes("UNIQUE constraint failed")) {
    return res.status(409).json({ error: "Email already exists" });
  }

  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}
