-- One row for each day, kind, name, host and path, with its count of hits.
-- No IP address and no full user agent is stored.
CREATE TABLE visits (
  day TEXT NOT NULL,                -- YYYY-MM-DD, UTC
  kind TEXT NOT NULL CHECK (kind IN ('ai_bot', 'link_share')),
  name TEXT NOT NULL,               -- the agent (GPTBot) or the app (iMessage)
  grp TEXT NOT NULL DEFAULT '',     -- the agent's group; '' for a link share
  host TEXT NOT NULL,
  path TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, name, host, path)
);

CREATE INDEX visits_by_day ON visits (day);
