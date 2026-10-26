const key = () => sessionStorage.getItem("adminKey") || (() => { const k = prompt("Enter admin key"); if (k) sessionStorage.setItem("adminKey", k); return k || ""; })();
const $ = (id) => document.getElementById(id);
const naira = (kobo) => "₦" + (kobo / 100).toLocaleString("en-NG");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const date = (s) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const badge = (s) => `<span class="badge ${esc(s)}">${esc(s)}</span>`;

let data = { stats: {}, transactions: [], customers: [], plans: [] };
let tab = "transactions";

async function get(url) {
  const res = await fetch(url, { headers: { "x-admin-key": key() } });
  if (res.status === 401) { sessionStorage.removeItem("adminKey"); throw new Error("unauthorized"); }
  if (!res.ok) throw new Error("Request failed: " + url);
  return res.json();
}

async function load() {
  const [stats, transactions, customers, plans] = await Promise.all([
    get("/api/admin/stats"), get("/api/admin/transactions"),
    get("/api/customers"), get("/api/plans"),
  ]);
  data = { stats, transactions, customers, plans };
  render();
}

function renderStats() {
  const s = data.stats;
  const cards = [
    ["Revenue", naira(s.revenueKobo)],
    ["Active subscriptions", s.activeSubscriptions],
    ["Customers", s.customers],
    ["Pending payments", s.pendingTransactions],
  ];
  $("stats").innerHTML = cards
    .map(([l, v]) => `<div class="stat"><div class="label">${l}</div><div class="value">${esc(v)}</div></div>`)
    .join("");
}

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
  $("table").innerHTML = rows.length
    ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
       <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`
    : `<tbody><tr><td class="empty">Nothing here yet</td></tr></tbody>`;
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
  const ref = e.target.dataset.ref;
  if (!ref) return;
  e.target.disabled = true;
  await fetch("/api/dev/simulate-payment/" + encodeURIComponent(ref), { method: "POST", headers: { "x-admin-key": key() } });
  load();
});

load().catch(() => ($("table").innerHTML = `<tbody><tr><td class="empty">Could not load data</td></tr></tbody>`));
