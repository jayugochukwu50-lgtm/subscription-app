import { Router } from "express";
import { db } from "./db.js";
import { validate } from "./middleware.js";
import { checkoutSchema } from "./schemas.js";
import { createSubscription, markTransactionPaid } from "./subscriptions.js";
import { initializeTransaction, verifyTransaction } from "./paystack.js";

export const payments = Router();

/**
 * Starts a payment: saves the customer, creates a pending transaction, and
 * asks Paystack for a hosted payment page. The browser sends only the plan id.
 * The amount is read from our database so it cannot be tampered with.
 */
payments.post("/checkout", validate(checkoutSchema), async (req, res, next) => {
  try {
    const { name, email, planId } = req.body;

    // A returning customer keeps their original record.
    db.prepare("INSERT OR IGNORE INTO customers (name, email) VALUES (?, ?)").run(name, email);
    const customer = db.prepare("SELECT id FROM customers WHERE email = ?").get(email) as {
      id: number;
    };

    const sub = createSubscription(customer.id, planId);
    if (!sub) return res.status(404).json({ error: "Plan not found" });

    const base = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
    const data = await initializeTransaction({
      email,
      amountKobo: sub.amount_kobo,
      reference: sub.reference,
      callbackUrl: `${base}/api/payments/callback`,
    });

    res.status(201).json({ authorizationUrl: data.authorization_url, reference: sub.reference });
  } catch (err) {
    next(err);
  }
});

/**
 * Where Paystack sends the customer after paying. The redirect itself proves
 * nothing, so we ask Paystack directly whether the payment really succeeded
 * and check the amount and currency before marking it paid.
 */
payments.get("/callback", async (req, res) => {
  const reference = String(req.query.reference ?? req.query.trxref ?? "");

  try {
    const tx = db
      .prepare("SELECT amount_kobo FROM transactions WHERE reference = ?")
      .get(reference) as { amount_kobo: number } | undefined;
    if (!tx) return res.redirect("/checkout.html?status=failed");

    const result = await verifyTransaction(reference);
    const genuine =
      result.status === "success" &&
      result.amount === tx.amount_kobo &&
      result.currency === "NGN";

    if (genuine) {
      markTransactionPaid(reference);
      return res.redirect("/checkout.html?status=success");
    }
    res.redirect("/checkout.html?status=failed");
  } catch (err) {
    console.error(err);
    res.redirect("/checkout.html?status=failed");
  }
});
