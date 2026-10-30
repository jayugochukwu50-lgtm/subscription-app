import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { app } from "../src/app.js";

let server: Server;
let base: string;
const SECRET = "test-secret";
const admin = { "x-admin-key": "test-key" };

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

const sign = (body: string) => createHmac("sha512", SECRET).update(body).digest("hex");

function sendWebhook(payload: unknown, signature?: string) {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sig = signature ?? sign(body);
  if (sig) headers["x-paystack-signature"] = sig;
  return fetch(base + "/webhooks/paystack", { method: "POST", headers, body });
}

async function json(path: string, body: unknown) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as any;
}

async function pendingReference(email: string) {
  const customer = await json("/api/customers", { name: "Hook Tester", email });
  const sub = await json("/api/subscriptions", { customerId: customer.id, planId: 1 });
  return sub.reference as string;
}

async function stats() {
  const res = await fetch(base + "/api/admin/stats", { headers: admin });
  return (await res.json()) as any;
}

const success = (reference: string, amount = 500000) => ({
  event: "charge.success",
  data: { reference, amount, currency: "NGN" },
});

test("rejects a webhook with a wrong signature", async () => {
  const ref = await pendingReference("bad-sig@test.com");
  const res = await sendWebhook(success(ref), "not-a-real-signature");
  assert.equal(res.status, 401);
});

test("rejects a webhook with no signature", async () => {
  const ref = await pendingReference("no-sig@test.com");
  const body = JSON.stringify(success(ref));
  const res = await fetch(base + "/webhooks/paystack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  assert.equal(res.status, 401);
});

test("a signed charge.success activates the subscription, and a repeat does not double count", async () => {
  const ref = await pendingReference("paid@test.com");
  const before = await stats();

  assert.equal((await sendWebhook(success(ref))).status, 200);
  assert.equal((await sendWebhook(success(ref))).status, 200);

  const after = await stats();
  assert.equal(after.activeSubscriptions, before.activeSubscriptions + 1);
  assert.equal(after.revenueKobo, before.revenueKobo + 500000);
});

test("a signed webhook with the wrong amount is ignored", async () => {
  const ref = await pendingReference("wrong-amount@test.com");
  const before = await stats();

  assert.equal((await sendWebhook(success(ref, 100))).status, 200);

  const after = await stats();
  assert.equal(after.activeSubscriptions, before.activeSubscriptions);
  assert.equal(after.revenueKobo, before.revenueKobo);
});
