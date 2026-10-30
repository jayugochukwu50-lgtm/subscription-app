const $ = (id) => document.getElementById(id);
const naira = (k) => "₦" + (k / 100).toLocaleString("en-NG");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
let selected = null;

const status = new URLSearchParams(location.search).get("status");
if (status === "success") {
  $("banner").innerHTML = '<div class="banner ok">Payment successful. Your subscription is now active.</div>';
} else if (status === "failed") {
  $("banner").innerHTML = '<div class="banner bad">Payment was not completed. You can try again below.</div>';
}

function pick(id) {
  selected = id;
  document.querySelectorAll(".plan").forEach((b) => b.classList.toggle("on", Number(b.dataset.id) === id));
}

async function loadPlans() {
  const plans = await (await fetch("/api/plans")).json();
  $("plans").innerHTML = plans
    .map(
      (p) => `<button type="button" class="plan" data-id="${p.id}">
        <span class="pname">${esc(p.name)}</span>
        <span class="price">${naira(p.price_kobo)}<small>/${esc(p.interval)}</small></span>
      </button>`
    )
    .join("");
  document.querySelectorAll(".plan").forEach((b) => b.addEventListener("click", () => pick(Number(b.dataset.id))));
  const wanted = Number(new URLSearchParams(location.search).get("plan")); if (plans.length) pick((plans.find((p) => p.id === wanted) || plans[0]).id);
}

$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("error").textContent = "";
  const btn = $("pay");
  btn.disabled = true;
  btn.textContent = "Redirecting...";
  try {
    const res = await fetch("/api/payments/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: $("name").value, email: $("email").value, planId: selected }),
    });
    const body = await res.json();
    if (!res.ok) {
      $("error").textContent = body.details ? body.details.map((d) => d.message).join(". ") : body.error;
      btn.disabled = false;
      btn.textContent = "Continue to payment";
      return;
    }
    location.href = body.authorizationUrl;
  } catch {
    $("error").textContent = "Network error. Please try again.";
    btn.disabled = false;
    btn.textContent = "Continue to payment";
  }
});

loadPlans();
