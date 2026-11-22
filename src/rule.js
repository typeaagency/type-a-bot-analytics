// The counting rule: a Cloudflare Worker on your site's routes. A GET or HEAD
// from an AI bot of the agent table, or from a chat or social app's link
// preview, is sent to YOUR dashboard beside your page, and is never waited
// for. The hit goes through the DASHBOARD service binding (a dashboard in the
// same account), or else to DASHBOARD_URL (a dashboard in another account). Every visitor, bots included, gets your own page,
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
    const send = sender(env);
    if (!visit || !send || !env.HIT_TOKEN) return;

    const url = new URL(request.url);
    const hit = {
      contract: CONTRACT,
      kind: visit.kind,
      host: url.hostname.toLowerCase(),
      path: url.pathname,
      user_agent: request.headers.get("User-Agent"),
      at: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
    };
    const sent = send({
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

// A fetch to a workers.dev address of the same account fails (Cloudflare
// error 1042), so a dashboard in the same account takes the hit through the
// service binding. The flag global_fetch_strictly_public is no fix: it sends
// the rule's own fetch(request) back to the rule, not to your origin.
function sender(env) {
  if (env.DASHBOARD) return (init) => env.DASHBOARD.fetch("https://dashboard/hit", init);
  if (env.DASHBOARD_URL) return (init) => fetch(new URL("/hit", env.DASHBOARD_URL), init);
  return null;
}
