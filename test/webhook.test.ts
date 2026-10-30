import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { useServer, adminHeaders } from "./helpers.js";

const server = useServer();

// Matches PAYSTACK_SECRET_KEY in the "test" script in package.json.
const SECRET = "test-secret";

const sign = (body: string) => createHmac("sha512", SECRET).update(body).digest("hex");

/** Sends a webhook the way Paystack does: raw JSON plus a signature header. */
function sendWebhook(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  return server.raw("/webhooks/paystack", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": signature ?? sign(body),
    },
    body,
  });
}

/** Creates a customer and a pending Basic subscription, and returns its reference. */
async function pendingReference(email: string) {
  const customer = (await (
    await server.post("/api/customers", { name: "Hook Tester", email })
  ).json()) as { id: number };
  const sub = (await (
    await server.post("/api/subscriptions", { customerId: customer.id, planId: 1 })
  ).json()) as { reference: string };
  return sub.reference;
}

async function stats() {
  const res = await server.get("/api/admin/stats", adminHeaders);
  return (await res.json()) as { activeSubscriptions: number; revenueKobo: number };
}

const chargeSuccess = (reference: string, amount = 500000) => ({
  event: "charge.success",
  data: { reference, amount, currency: "NGN" },
});

test("rejects a webhook with a wrong signature", async () => {
  const ref = await pendingReference("bad-sig@test.com");
  const res = await sendWebhook(chargeSuccess(ref), "not-a-real-signature");
  assert.equal(res.status, 401);
});

test("rejects a webhook with no signature", async () => {
  const ref = await pendingReference("no-sig@test.com");
  const res = await server.raw("/webhooks/paystack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chargeSuccess(ref)),
  });
  assert.equal(res.status, 401);
});

test("a signed charge.success activates the subscription, and a repeat does not double count", async () => {
  const ref = await pendingReference("paid@test.com");
  const before = await stats();

  assert.equal((await sendWebhook(chargeSuccess(ref))).status, 200);
  assert.equal((await sendWebhook(chargeSuccess(ref))).status, 200);

  const after = await stats();
  assert.equal(after.activeSubscriptions, before.activeSubscriptions + 1);
  assert.equal(after.revenueKobo, before.revenueKobo + 500000);
});

test("a signed webhook with the wrong amount is ignored", async () => {
  const ref = await pendingReference("wrong-amount@test.com");
  const before = await stats();

  assert.equal((await sendWebhook(chargeSuccess(ref, 100))).status, 200);

  const after = await stats();
  assert.equal(after.activeSubscriptions, before.activeSubscriptions);
  assert.equal(after.revenueKobo, before.revenueKobo);
});
