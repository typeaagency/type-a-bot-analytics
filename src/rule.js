// The counting rule: a Cloudflare Worker on your site's routes. A GET or HEAD
// from an AI bot of the agent table, or from a chat or social app's link
// preview, is sent to YOUR dashboard (DASHBOARD_URL) beside your page, and is
// never waited for. Every visitor, bots included, gets your own page,
// unchanged. If anything here fails, your page is served as if the Worker
// were not there. It sends nothing to anyone but your dashboard.
import { CONTRACT, classify } from "./match.js";

export default {
  async fetch(request, env, ctx) {
    ctx.passThroughOnException();
    if (request.method === "GET" || request.method === "HEAD") count(request, env, ctx);
    return fetch(request);
  },
};

function count(request, env, ctx) {
  try {
    const visit = classify(request.headers.get("User-Agent"));
    if (!visit || !env.DASHBOARD_URL || !env.HIT_TOKEN) return;

    const url = new URL(request.url);
    const hit = {
      contract: CONTRACT,
      kind: visit.kind,
      host: url.hostname.toLowerCase(),
      path: url.pathname,
      user_agent: request.headers.get("User-Agent"),
      at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    };
    const sent = fetch(new URL("/hit", env.DASHBOARD_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.HIT_TOKEN}` },
      body: JSON.stringify(hit),
    }).then(
      (answer) => answer.body && answer.body.cancel(),
      () => {},
    );
    ctx.waitUntil(sent.catch(() => {}));
  } catch {
    // Never the visitor's problem.
  }
}
