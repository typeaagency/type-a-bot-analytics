// The one HTML page of the dashboard. No script, no outside request.
const GROUPS = [
  ["training", "Training", "collects pages to train a model"],
  ["search_index", "AI search", "builds an AI search index"],
  ["user_fetch", "User fetch", "reads a page the moment a person asks"],
];

export function page({ days, since, agents, apps, pages }) {
  const botTotal = sum(agents);
  const shareTotal = sum(apps);
  const periods = [7, 30, 90]
    .map((n) => (n === days ? `<b>${n} days</b>` : `<a href="/?days=${n}">${n} days</a>`))
    .join(" · ");

  const groups = GROUPS.map(([key, label, about]) => {
    const rows = agents.filter((agent) => agent.grp === key);
    return `<section class="card">
      <h3>${label} <span class="n">${number(sum(rows))}</span></h3>
      <p class="about">${about}</p>
      ${bars(rows, "No visits")}
    </section>`;
  }).join("");

  const pageRows = pages
    .map(
      (row) => `<tr><td class="path">${escape(row.host + row.path).replaceAll("/", "/<wbr>")}</td>
        <td class="n">${number(row.bots)}</td><td class="n">${number(row.shares)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Type A Bot Analytics</title>
<style>
  :root { color-scheme: light dark; --fg: #111; --muted: #666; --line: #e3e3e3; --bar: #3b5bdb; --card: #fafafa; }
  @media (prefers-color-scheme: dark) { :root { --fg: #eee; --muted: #999; --line: #333; --bar: #748ffc; --card: #1a1a1a; } }
  body { font: 15px/1.5 system-ui, sans-serif; color: var(--fg); max-width: 960px; margin: 0 auto; padding: 32px 20px; }
  h1 { font-size: 22px; margin: 0; } h2 { font-size: 17px; margin: 32px 0 12px; } h3 { font-size: 15px; margin: 0; display: flex; justify-content: space-between; }
  header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
  a { color: var(--bar); } .muted, .about { color: var(--muted); } .about { margin: 2px 0 12px; font-size: 13px; }
  .totals { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 24px; }
  .total { border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: var(--card); }
  .total b { display: block; font-size: 28px; font-variant-numeric: tabular-nums; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
  .card { border: 1px solid var(--line); border-radius: 8px; padding: 16px; background: var(--card); }
  .bar { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 6px 0; font-size: 14px; }
  .bar i { grid-column: 1 / -1; height: 6px; border-radius: 3px; background: var(--bar); min-width: 2px; }
  .n { font-variant-numeric: tabular-nums; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 8px 0; border-bottom: 1px solid var(--line); text-align: left; } th.n { text-align: right; }
  td.path { overflow-wrap: anywhere; padding-right: 16px; }
  th { padding-left: 12px; } th:first-child { padding-left: 0; } th.n { width: 1%; }
  .scroll { overflow-x: auto; }
  .card > :last-child { margin-bottom: 0; }
  footer { margin-top: 40px; font-size: 13px; color: var(--muted); }
</style>
</head>
<body>
<header><h1>Type A Bot Analytics</h1><nav>${periods}</nav></header>
<p class="muted">Since ${since} (UTC)</p>
<div class="totals">
  <div class="total">AI bot visits<b>${number(botTotal)}</b></div>
  <div class="total">Link shares<b>${number(shareTotal)}</b></div>
</div>
<h2>AI bot visits by group</h2>
<div class="grid">${groups}</div>
<h2>Link shares by app</h2>
<section class="card">${bars(apps, "No link shares")}</section>
<h2>Top pages</h2>
${pageRows ? `<div class="scroll"><table><thead><tr><th>Page</th><th class="n">AI bot visits</th><th class="n">Link shares</th></tr></thead><tbody>${pageRows}</tbody></table></div>` : `<p class="muted">No visits</p>`}
<footer>Type A Bot Analytics, self-hosted. The hosted version: <a href="https://report.typeamedia.net">report.typeamedia.net</a> · <a href="https://typeamedia.net">typeamedia.net</a></footer>
</body>
</html>`;
}

function bars(rows, empty) {
  if (rows.length === 0) return `<p class="muted">${empty}</p>`;
  const top = Math.max(...rows.map((row) => row.hits));
  return rows
    .map(
      (row) => `<div class="bar"><span>${escape(row.name)}</span><span class="n">${number(row.hits)}</span>
        <i style="width:${Math.max(1, Math.round((row.hits / top) * 100))}%"></i></div>`,
    )
    .join("");
}

const sum = (rows) => rows.reduce((total, row) => total + row.hits, 0);
const number = (value) => Number(value).toLocaleString("en-GB");

export function escape(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}
