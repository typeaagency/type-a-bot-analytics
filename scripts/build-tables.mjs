// Turns the two tables in tables/ into src/tables.js, the one module the rule
// and the dashboard read. Wrangler runs it before each build, so the YAML files
// are the only source. Never edit the tables here: they are copied from Type A's
// own repo, and a copy PR replaces them.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = /^[A-Za-z0-9-]+(\/[A-Za-z0-9-]*)?$/;

export function agentsFrom(text) {
  const groups = parse(text);
  const agents = [];
  for (const [group, list] of Object.entries(groups)) {
    for (const { name } of list) {
      if (!TOKEN.test(name) || name.includes("/")) throw new Error(`bad agent name: ${name}`);
      agents.push({ name, group });
    }
  }
  if (agents.length === 0) throw new Error("the agent table is empty");
  return agents;
}

export function appsFrom(text) {
  const apps = parse(text).map(({ name, match, tokens }) => {
    if (!["any", "all"].includes(match)) throw new Error(`bad match for ${name}: ${match}`);
    for (const token of tokens) if (!TOKEN.test(token)) throw new Error(`bad token for ${name}: ${token}`);
    return { name, match, tokens };
  });
  if (apps.length === 0) throw new Error("the app table is empty");
  return apps;
}

export function build() {
  const agents = agentsFrom(readFileSync(join(root, "tables/ai_crawler_agents.yml"), "utf8"));
  const apps = appsFrom(readFileSync(join(root, "tables/link_share_apps.yml"), "utf8"));
  const source =
    "// Made by scripts/build-tables.mjs from tables/. Do not edit.\n" +
    `export const AGENTS = ${JSON.stringify(agents, null, 2)};\n` +
    `export const APPS = ${JSON.stringify(apps, null, 2)};\n`;
  // Written only on a change, so a dev server that watches src/ does not loop.
  const target = join(root, "src/tables.js");
  if (!existsSync(target) || readFileSync(target, "utf8") !== source) writeFileSync(target, source);
  return { agents: agents.length, apps: apps.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { agents, apps } = build();
  console.log(`src/tables.js: ${agents} agents, ${apps} apps`);
}
