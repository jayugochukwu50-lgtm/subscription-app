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

test("home page is served at /", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Simple plans/);
});

test("admin dashboard is served at /admin", async () => {
  const res = await fetch(base + "/admin");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Admin sign in/);
});
