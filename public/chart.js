(() => {
  const naira = (k) => "₦" + (k / 100).toLocaleString("en-NG");
  const label = (d) =>
    new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

  function draw(rows) {
    const box = document.getElementById("chart");
    if (!box) return;
    const total = rows.reduce((s, r) => s + r.totalKobo, 0);
    if (total === 0) {
      box.innerHTML = '<p class="empty">No revenue yet. Completed payments will appear here.</p>';
      return;
    }
    const W = 600, H = 220, padX = 8, padTop = 14, padBottom = 28;
    const max = Math.max(...rows.map((r) => r.totalKobo), 1);
    const bw = (W - padX * 2) / rows.length;
    const plotH = H - padTop - padBottom;

    const bars = rows
      .map((r, i) => {
        const h = r.totalKobo ? Math.max(Math.round((r.totalKobo / max) * plotH), 4) : 2;
        const x = padX + i * bw + bw * 0.18;
        const y = H - padBottom - h;
        return `<g><title>${label(r.day)}: ${naira(r.totalKobo)}</title><rect class="bar${r.totalKobo ? "" : " zero"}" x="${x.toFixed(1)}" y="${y}" width="${(bw * 0.64).toFixed(1)}" height="${h}" rx="4"></rect></g>`;
      })
      .join("");

    const labels = rows
      .map((r, i) =>
        i % 4 === 1
          ? `<text class="axis" x="${(padX + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${label(r.day)}</text>`
          : ""
      )
      .join("");

    box.innerHTML =
      `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue over the last 14 days">${bars}${labels}</svg>` +
      `<p class="sub chart-total">Total: ${naira(total)}</p>`;
  }

  window.loadChart = async () => {
    try {
      const res = await fetch("/api/admin/revenue", {
        headers: { "x-admin-key": sessionStorage.getItem("adminKey") || "" },
      });
      if (!res.ok) return;
      draw(await res.json());
    } catch {
      /* chart is optional, so fail quietly */
    }
  };
})();
