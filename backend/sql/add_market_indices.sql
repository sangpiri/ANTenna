-- market_indices 테이블 추가 마이그레이션
-- 실행: psql $DATABASE_URL -f backend/sql/add_market_indices.sql

CREATE TABLE IF NOT EXISTS market_indices (
    date        DATE NOT NULL,
    ticker      VARCHAR(20) NOT NULL,
    name        VARCHAR(100) NOT NULL,
    open        DECIMAL(15,4),
    high        DECIMAL(15,4),
    low         DECIMAL(15,4),
    close       DECIMAL(15,4) NOT NULL,
    volume      BIGINT,
    change_rate DECIMAL(10,4),
    PRIMARY KEY (date, ticker)
);

SELECT create_hypertable('market_indices', 'date',
    chunk_time_interval => INTERVAL '1 year',
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS idx_market_indices_ticker_date ON market_indices (ticker, date DESC);

ALTER TABLE market_indices SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'ticker',
    timescaledb.compress_orderby = 'date DESC'
);
SELECT add_compression_policy('market_indices', INTERVAL '90 days', if_not_exists => TRUE);
