const naira = (k) => "₦" + (k / 100).toLocaleString("en-NG");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const FEATURES = {
  Basic: ["Core features", "Email support", "Cancel anytime"],
  Pro: ["Everything in Basic", "Priority support", "Advanced reports"],
  Premium: ["Everything in Pro", "Dedicated manager", "Custom integrations"],
};

async function load() {
  const box = document.getElementById("pricing");
  try {
    const plans = await (await fetch("/api/plans")).json();
    box.innerHTML = plans
      .map((p, i) => {
        const popular = i === 1;
        const list = (FEATURES[p.name] || ["Full access", "Email support"])
          .map((f) => `<li>${esc(f)}</li>`)
          .join("");
        return `<article class="tier${popular ? " popular" : ""}">
          ${popular ? '<span class="pop">Most popular</span>' : ""}
          <h3>${esc(p.name)}</h3>
          <div class="tprice">${naira(p.price_kobo)}<small>/${esc(p.interval)}</small></div>
          <ul>${list}</ul>
          <a class="primary" href="/checkout.html?plan=${Number(p.id)}">Choose ${esc(p.name)}</a>
        </article>`;
      })
      .join("");
  } catch {
    box.innerHTML = '<p class="muted">Plans could not be loaded. Please refresh.</p>';
  }
}

load();
