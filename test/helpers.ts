import { before, after } from "node:test";
import type { Server } from "node:http";
import { app } from "../src/app.js";

// Matches the ADMIN_KEY set in the "test" script in package.json.
export const adminHeaders = { "x-admin-key": "test-key" };

/**
 * Starts the app on a random free port before a test file runs and stops it
 * afterwards. Returns small helpers so tests can call the API without
 * repeating URLs or headers.
 */
export function useServer() {
  let server: Server;
  let base = "";

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

  return {
    get: (path: string, headers: Record<string, string> = {}) =>
      fetch(base + path, { headers }),

    post: (path: string, body: unknown, headers: Record<string, string> = {}) =>
      fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),

    // For tests that need full control over the request.
    raw: (path: string, init: RequestInit) => fetch(base + path, init),
  };
}
