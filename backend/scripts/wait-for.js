// node scripts/wait-for.js <url> [seconds]  — waits until the URL answers (used by the Windows launcher)
const [url, secs = '60'] = process.argv.slice(2);
const end = Date.now() + Number(secs) * 1000;
(async function poll() {
  try { const r = await fetch(url); if (r.ok) { console.log(`Up: ${url}`); process.exit(0); } } catch { /* not up yet */ }
  if (Date.now() > end) { console.log(`Not reachable (continuing without it): ${url}`); process.exit(0); }
  setTimeout(poll, 1500);
})();
