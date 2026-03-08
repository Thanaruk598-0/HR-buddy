CREATE TABLE IF NOT EXISTS abuse_rate_limit_counters (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, key_hash)
);

CREATE INDEX IF NOT EXISTS idx_abuse_rate_limit_counters_updated_at
  ON abuse_rate_limit_counters(updated_at);

CREATE INDEX IF NOT EXISTS idx_abuse_rate_limit_counters_scope_updated_at
  ON abuse_rate_limit_counters(scope, updated_at);
