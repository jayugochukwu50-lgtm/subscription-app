import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { db } from "./db.js";
import { markTransactionPaid } from "./subscriptions.js";

/**
 * Handles events sent by Paystack.
 *
 * Paystack signs every webhook with an HMAC SHA-512 of the raw request body,
 * using our secret key. We recompute that signature and reject any request
 * that does not match, so only Paystack can mark a payment as paid.
 */
export function paystackWebhook(req: Request, res: Response) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return res.sendStatus(500);

  // The signature covers the exact bytes Paystack sent, so we use the raw
  // body saved in app.ts, not the parsed JSON.
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw) return res.sendStatus(401);

  const expected = Buffer.from(createHmac("sha512", secret).update(raw).digest("hex"));
  const given = Buffer.from(req.header("x-paystack-signature") ?? "");

  // timingSafeEqual throws on different lengths, so compare lengths first.
  // The constant-time comparison stops attackers guessing the signature
  // by measuring how long the check takes.
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return res.sendStatus(401);
  }

  const { event, data } = req.body ?? {};

  if (event === "charge.success" && data?.reference) {
    const reference = String(data.reference);
    const tx = db
      .prepare("SELECT amount_kobo FROM transactions WHERE reference = ?")
      .get(reference) as { amount_kobo: number } | undefined;

    // Only accept the payment if the amount and currency match what we
    // expected to charge, even though the signature is valid.
    if (tx && data.amount === tx.amount_kobo && data.currency === "NGN") {
      markTransactionPaid(reference);
    }
  }

  // Always answer 200 to a correctly signed request, so Paystack does not
  // keep retrying events we have already handled or chosen to ignore.
  res.sendStatus(200);
}
