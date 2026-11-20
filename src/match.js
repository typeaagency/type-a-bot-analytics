// Which visit a user agent is: an AI bot of the agent table, a link preview of
// the app table, or neither. The rule and the dashboard both ask this module,
// so a visit is named the same way in both. Case is ignored everywhere.
import { AGENTS, APPS } from "./tables.js";

// The longest name first, so a name that holds another name wins.
const agents = [...AGENTS]
  .map((agent) => ({ ...agent, token: agent.name.toLowerCase() }))
  .sort((a, b) => b.token.length - a.token.length);

// The `all` apps first, the one with the most tokens first: iMessage sends the
// Facebook and X tokens together, so it is never Facebook or X. Then each
// token of the `any` apps, the longest first: Telegram's
// "TelegramBot (like TwitterBot)" is never X.
const allApps = APPS.filter((app) => app.match === "all")
  .map((app) => ({ name: app.name, tokens: app.tokens.map((token) => token.toLowerCase()) }))
  .sort((a, b) => b.tokens.length - a.tokens.length);
const anyTokens = APPS.filter((app) => app.match === "any")
  .flatMap((app) => app.tokens.map((token) => ({ name: app.name, token: token.toLowerCase() })))
  .sort((a, b) => b.token.length - a.token.length);

export const AI_BOT = "ai_bot";
export const LINK_SHARE = "link_share";
// The hit the rule sends and the dashboard takes (no IP address in it).
export const CONTRACT = "typea-bot-hit/3";

// { kind, name, group } for a counted user agent, or null. An AI agent is
// always an AI bot visit, never a share.
export function classify(userAgent) {
  const text = String(userAgent || "").toLowerCase();
  if (!text) return null;

  const agent = agents.find(({ token }) => text.includes(token));
  if (agent) return { kind: AI_BOT, name: agent.name, group: agent.group };

  const app =
    allApps.find(({ tokens }) => tokens.every((token) => text.includes(token))) ||
    anyTokens.find(({ token }) => text.includes(token));
  if (app) return { kind: LINK_SHARE, name: app.name, group: "" };

  return null;
}
