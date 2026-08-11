CREATE TABLE IF NOT EXISTS market_snapshots (
  market text NOT NULL CHECK (market IN ('KOSPI', 'KOSDAQ', 'NASDAQ')),
  captured_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (market, captured_at)
);

CREATE INDEX IF NOT EXISTS market_snapshots_recent
ON market_snapshots (market, captured_at DESC);

CREATE TABLE IF NOT EXISTS ingestion_state (
  source text PRIMARY KEY,
  last_success_at timestamptz,
  status text NOT NULL,
  message text
);
