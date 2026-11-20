import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import dashboard from "../src/dashboard.js";
import { escape } from "../src/page.js";
import { UA, d1 } from "./helpers.js";

let env;
beforeEach(() => (env = { DB: d1(), HIT_TOKEN: "secret-token", DASHBOARD_PASSWORD: "pass" }));

const post = (hit, token = "secret-token") =>
  dashboard.fetch(
    new Request("https://dash.test/hit", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ contract: "typea-bot-hit/3", host: "example.com", path: "/a", ...hit }),
    }),
    env,
  );
const view = (password = "pass", query = "") =>
  dashboard.fetch(
    new Request(`https://dash.test/${query}`, { headers: { Authorization: `Basic ${btoa(`me:${password}`)}` } }),
    env,
  );

test("hits count per day, name and page; the dashboard names the visit itself", async () => {
  assert.equal((await post({ user_agent: UA.gptbot, kind: "link_share" })).status, 202);
  assert.equal((await post({ user_agent: UA.gptbot })).status, 202);
  assert.equal((await post({ user_agent: UA.imessage, path: "/b" })).status, 202);
  const rows = env.DB.sqlite.prepare("SELECT kind, name, grp, path, hits FROM visits ORDER BY name").all();
  assert.deepEqual(
    rows.map((row) => ({ ...row })),
    [
      { kind: "ai_bot", name: "GPTBot", grp: "training", path: "/a", hits: 2 },
      { kind: "link_share", name: "iMessage", grp: "", path: "/b", hits: 1 },
    ],
  );
});

test("a hit is refused without the token, with another contract, or for a browser", async () => {
  assert.equal((await post({ user_agent: UA.gptbot }, "wrong")).status, 401);
  assert.equal((await post({ user_agent: UA.gptbot, contract: "typea-bot-hit/2" })).status, 400);
  assert.equal((await post({ user_agent: UA.gptbot, path: "no-slash" })).status, 400);
  assert.equal((await post({ user_agent: UA.gptbot, host: "bad host" })).status, 400);
  assert.equal((await post({ user_agent: UA.chrome })).status, 422);
  assert.equal(env.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM visits").get().n, 0);
});

test("the page needs the password", async () => {
  assert.equal((await view("wrong")).status, 401);
  assert.equal((await dashboard.fetch(new Request("https://dash.test/"), env)).status, 401);
  delete env.DASHBOARD_PASSWORD;
  assert.equal((await view()).status, 503);
});

test("the page shows bot visits by group, shares by app and the top pages", async () => {
  await post({ user_agent: UA.gptbot });
  await post({ user_agent: UA.imessage, path: "/shared" });
  const answer = await view("pass", "?days=7");
  assert.equal(answer.status, 200);
  const html = await answer.text();
  for (const words of [
    "Training",
    "GPTBot",
    "iMessage",
    "example.com/<wbr>shared",
    "<b>7 days</b>",
    "report.typeamedia.net",
  ]) {
    assert.ok(html.includes(words), words);
  }
});

test("the page escapes what it shows", async () => {
  assert.equal(escape(`<a href="x">'&`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  await post({ user_agent: UA.gptbot, path: "/<script>" });
  assert.ok(!(await (await view()).text()).includes("<script>"));
});
