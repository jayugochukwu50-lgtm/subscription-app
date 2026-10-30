import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { app } from "../src/app.js";

let server: Server;
let base: string;

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

test("revenue endpoint requires the admin key", async () => {
  const res = await fetch(base + "/api/admin/revenue");
  assert.equal(res.status, 401);
});

test("revenue endpoint returns 14 days, zero filled", async () => {
  const res = await fetch(base + "/api/admin/revenue", { headers: { "x-admin-key": "test-key" } });
  assert.equal(res.status, 200);
  const rows = (await res.json()) as { day: string; totalKobo: number }[];
  assert.equal(rows.length, 14);
  assert.ok(rows.every((r) => typeof r.totalKobo === "number" && r.totalKobo >= 0));
});
