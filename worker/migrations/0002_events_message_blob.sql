DROP INDEX IF EXISTS idx_events_sid_seq;
DROP TABLE IF EXISTS events;

CREATE TABLE events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  sid     TEXT NOT NULL,
  uid     TEXT NOT NULL,
  message TEXT NOT NULL,
  meta    TEXT,
  created INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_events_sid_id ON events(sid, id ASC);
