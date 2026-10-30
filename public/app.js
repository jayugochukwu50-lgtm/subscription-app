const $ = (id) => document.getElementById(id);
const naira = (kobo) => "₦" + (kobo / 100).toLocaleString("en-NG");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const date = (s) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;

class AuthError extends Error {}

let data = { stats: {}, transactions: [], customers: [], plans: [] };
let tab = "transactions";
const getKey = () => sessionStorage.getItem("adminKey") || "";

async function get(url) {
  const res = await fetch(url, { headers: { "x-admin-key": getKey() } });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error("Request failed: " + url);
  return res.json();
}

function showSkeleton() {
  $("stats").innerHTML = [1, 2, 3, 4]
    .map(() => '<div class="stat"><div class="skel l"></div><div class="skel v"></div></div>')
    .join("");
  $("table").innerHTML =
    "<tbody>" +
    [1, 2, 3, 4]
      .map(() => '<tr class="skel-row"><td colspan="6"><div class="skel line"></div></td></tr>')
      .join("") +
    "</tbody>";
}

async function load() {
  showSkeleton();
  const [stats, transactions, customers, plans] = await Promise.all([
    get("/api/admin/stats"), get("/api/admin/transactions"),
    get("/api/customers"), get("/api/plans"),
  ]);
  data = { stats, transactions, customers, plans };
  window.loadChart?.();
  render();
}

function showLogin(message = "") {
  $("loginError").textContent = message;
  $("login").hidden = false;
  $("key").focus();
}
const hideLogin = () => ($("login").hidden = true);

function handleError(err) {
  if (err instanceof AuthError) {
    const hadKey = Boolean(getKey());
    sessionStorage.removeItem("adminKey");
    showLogin(hadKey ? "That key is not correct. Please try again." : "");
    return;
  }
  $("stats").innerHTML = "";
  $("table").innerHTML = `<tbody><tr><td class="empty">
    <strong>Could not load data</strong>
    <small>Check your connection and that the server is running.</small>
    <button class="pay retry" data-retry="1">Try again</button>
  </td></tr></tbody>`;
}

function renderStats() {
  const s = data.stats;
  const cards = [
    ["Revenue", naira(s.revenueKobo ?? 0)],
    ["Active subscriptions", s.activeSubscriptions ?? 0],
    ["Customers", s.customers ?? 0],
    ["Pending payments", s.pendingTransactions ?? 0],
  ];
  $("stats").innerHTML = cards
    .map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="value">${esc(v)}</div></div>`)
    .join("");
}

const EMPTY = {
  transactions: ["No transactions yet", "Payments will appear here once customers subscribe."],
  customers: ["No customers yet", "Customers are added when they check out."],
  plans: ["No plans yet", "Plans you create will be listed here."],
};

const views = {
  transactions: () => ({
    head: ["Customer", "Plan", "Amount", "Status", "Date", ""],
    rows: data.transactions.map((t) => [
      `${esc(t.customer)}<div class="sub">${esc(t.email)}</div>`,
      esc(t.plan), naira(t.amount_kobo), badge(t.status), date(t.created_at),
      t.status === "pending" ? `<button class="pay" data-ref="${esc(t.reference)}">Simulate pay</button>` : "",
    ]),
  }),
  customers: () => ({
    head: ["Name", "Email", "Joined"],
    rows: data.customers.map((c) => [esc(c.name), esc(c.email), date(c.created_at)]),
  }),
  plans: () => ({
    head: ["Plan", "Price", "Billing"],
    rows: data.plans.map((p) => [esc(p.name), naira(p.price_kobo), esc(p.interval)]),
  }),
};

function render() {
  renderStats();
  const { head, rows } = views[tab]();
  const [title, hint] = EMPTY[tab];
  $("table").innerHTML = rows.length
    ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
       <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="empty"><strong>${title}</strong><small>${hint}</small></td></tr></tbody>`;
}

document.querySelectorAll(".tab").forEach((btn) =>
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    tab = btn.dataset.tab;
    render();
  })
);

$("table").addEventListener("click", async (e) => {
  if (e.target.dataset.retry) {
    return load().catch(handleError);
  }
  const ref = e.target.dataset.ref;
  if (!ref) return;
  e.target.disabled = true;
  e.target.textContent = "Paying...";
  const res = await fetch("/api/dev/simulate-payment/" + encodeURIComponent(ref), {
    method: "POST",
    headers: { "x-admin-key": getKey() },
  });
  if (res.status === 401) return handleError(new AuthError());
  load().catch(handleError);
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = $("key").value.trim();
  if (!value) return showLogin("Please enter your admin key.");
  sessionStorage.setItem("adminKey", value);
  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Checking...";
  try {
    await load();
    hideLogin();
    $("key").value = "";
  } catch (err) {
    handleError(err);
  } finally {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Sign in";
  }
});

$("signout").addEventListener("click", () => {
  sessionStorage.removeItem("adminKey");
  data = { stats: {}, transactions: [], customers: [], plans: [] };
  render();
  showLogin();
});

if (getKey()) {
  load().catch(handleError);
} else {
  render();
  showLogin();
}
