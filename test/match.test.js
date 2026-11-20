import assert from "node:assert/strict";
import { test } from "node:test";
import { agentsFrom, appsFrom } from "../scripts/build-tables.mjs";
import { classify } from "../src/match.js";
import { UA } from "./helpers.js";

test("an AI agent is an AI bot visit, with its group", () => {
  assert.deepEqual(classify(UA.gptbot), { kind: "ai_bot", name: "GPTBot", group: "training" });
  assert.deepEqual(classify(UA.claudeSearch), { kind: "ai_bot", name: "Claude-SearchBot", group: "search_index" });
});

test("iMessage carries the Facebook and X tokens, and is iMessage", () => {
  assert.deepEqual(classify(UA.imessage), { kind: "link_share", name: "iMessage", group: "" });
  assert.equal(classify(UA.facebook).name, "Facebook / Messenger / Instagram");
});

test("Telegram's preview names X, and is Telegram", () => {
  assert.equal(classify(UA.telegram).name, "Telegram");
});

test("case is ignored", () => {
  assert.equal(classify("gptbot/1.0").name, "GPTBot");
});

test("a browser, an empty or a missing user agent is not counted", () => {
  assert.equal(classify(UA.chrome), null);
  assert.equal(classify(""), null);
  assert.equal(classify(null), null);
});

test("the table reader refuses a bad table", () => {
  assert.throws(() => agentsFrom("training:\n  - { name: 'Bad Bot' }\n"), /bad agent name/);
  assert.throws(() => appsFrom("- { name: X, match: some, tokens: [ x ] }\n"), /bad match/);
  assert.throws(() => appsFrom("- { name: X, match: any, tokens: [ 'a b' ] }\n"), /bad token/);
});
