import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import rule from "../src/rule.js";
import { UA } from "./helpers.js";

const env = { DASHBOARD_URL: "https://dash.example.workers.dev", HIT_TOKEN: "secret-token" };
let calls;
let waited;
const ctx = { passThroughOnException() {}, waitUntil: (promise) => waited.push(promise) };
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  waited = [];
  globalThis.fetch = async (target, init) => {
    calls.push({ url: String(target instanceof Request ? target.url : target), init });
    return new Response("page");
  };
});
afterEach(() => (globalThis.fetch = realFetch));

const visit = (agent, method = "GET") =>
  new Request("https://Example.com/blog/post?x=1", { method, headers: { "User-Agent": agent } });

test("a GPTBot visit gets the page and sends one hit to the dashboard only", async () => {
  const answer = await rule.fetch(visit(UA.gptbot), env, ctx);
  await Promise.all(waited);
  assert.equal(await answer.text(), "page");
  assert.equal(calls.length, 2);
  const hit = calls.find((call) => call.url === "https://dash.example.workers.dev/hit");
  assert.equal(hit.init.headers.Authorization, "Bearer secret-token");
  const body = JSON.parse(hit.init.body);
  assert.equal(body.contract, "typea-bot-hit/3");
  assert.equal(body.kind, "ai_bot");
  assert.equal(body.host, "example.com");
  assert.equal(body.path, "/blog/post");
  assert.match(body.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(body.ip, undefined);
});

test("an iMessage preview is sent as a link share", async () => {
  await rule.fetch(visit(UA.imessage), env, ctx);
  await Promise.all(waited);
  const hit = calls.find((call) => call.url.endsWith("/hit"));
  assert.equal(JSON.parse(hit.init.body).kind, "link_share");
});

test("a dashboard in the same account takes the hit through the service binding", async () => {
  const bound = [];
  const DASHBOARD = { fetch: async (target, init) => (bound.push({ url: String(target), init }), new Response("ok")) };
  const answer = await rule.fetch(visit(UA.gptbot), { ...env, DASHBOARD }, ctx);
  await Promise.all(waited);
  assert.equal(await answer.text(), "page");
  assert.deepEqual(
    calls.map((call) => call.url),
    ["https://example.com/blog/post?x=1"],
  );
  assert.equal(bound.length, 1);
  assert.equal(new URL(bound[0].url).pathname, "/hit");
  assert.equal(bound[0].init.headers.Authorization, "Bearer secret-token");
  assert.equal(JSON.parse(bound[0].init.body).kind, "ai_bot");
});

test("a browser, a POST, or a rule with no dashboard sends no hit", async () => {
  await rule.fetch(visit(UA.chrome), env, ctx);
  await rule.fetch(visit(UA.gptbot, "POST"), env, ctx);
  await rule.fetch(visit(UA.gptbot), {}, ctx);
  assert.equal(calls.filter((call) => call.url.endsWith("/hit")).length, 0);
  assert.equal(calls.length, 3);
});

test("a dashboard that fails never reaches the visitor", async () => {
  globalThis.fetch = async (target) => {
    if (String(target).endsWith("/hit")) throw new Error("down");
    return new Response("page");
  };
  const answer = await rule.fetch(visit(UA.gptbot), env, ctx);
  await Promise.all(waited);
  assert.equal(await answer.text(), "page");
});

test("each Worker module exports its handler only, as workerd demands", async () => {
  for (const path of ["../src/rule.js", "../src/dashboard.js"]) {
    assert.deepEqual(Object.keys(await import(path)), ["default"], path);
  }
});
