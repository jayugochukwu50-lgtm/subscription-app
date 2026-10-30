import { createHmac, timingSafeEqual } from "node:crypto";
import { Request, Response } from "express";
import { db } from "./db.js";
import { markTransactionPaid } from "./subscriptions.js";

export function paystackWebhook(req: Request, res: Response) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.sendStatus(500);

  const raw: Buffer | undefined = (req as any).rawBody;
  if (!raw) return res.sendStatus(401);

  const expected = Buffer.from(createHmac("sha512", secret).update(raw).digest("hex"));
  const given = Buffer.from(req.header("x-paystack-signature") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.sendStatus(401);
  }

  const { event, data } = req.body ?? {};
  if (event === "charge.success" && data?.reference) {
    const reference = String(data.reference);
    const tx = db
      .prepare("SELECT amount_kobo FROM transactions WHERE reference = ?")
      .get(reference) as { amount_kobo: number } | undefined;
    if (tx && data.amount === tx.amount_kobo && data.currency === "NGN") {
      markTransactionPaid(reference);
    }
  }
  res.sendStatus(200);
}
