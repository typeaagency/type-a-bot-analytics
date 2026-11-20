// A D1 database for the tests, on Node's own SQLite, with the real migration.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

export function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../dashboard/migrations/0001_visits.sql", import.meta.url), "utf8"));
  return {
    sqlite: db,
    prepare(sql) {
      let values = [];
      const statement = {
        bind: (...args) => ((values = args), statement),
        run: async () => db.prepare(sql).run(...values),
        all: async () => ({
          results: db
            .prepare(sql)
            .all(...values)
            .map((row) => ({ ...row })),
        }),
      };
      return statement;
    },
  };
}

export const UA = {
  gptbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot",
  imessage:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0",
  facebook: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  telegram: "TelegramBot (like TwitterBot)",
  claudeSearch: "Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +Claude-SearchBot@anthropic.com)",
  chrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36",
};
