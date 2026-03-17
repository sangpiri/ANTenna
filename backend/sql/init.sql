-- ================================================
-- ANTenna DB 스키마 초기화
-- ================================================

-- TimescaleDB 확장 활성화
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ================================================
-- 1. 주가 데이터 테이블 (하이퍼테이블)
-- ================================================

-- 한국 주식 일봉
CREATE TABLE IF NOT EXISTS kr_stock_daily (
    date          DATE NOT NULL,
    code          VARCHAR(20) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    open          BIGINT,
    high          BIGINT,
    low           BIGINT,
    close         BIGINT NOT NULL,
    volume        BIGINT,
    change_rate   DECIMAL(10,4),
    market_cap    BIGINT,
    trading_value BIGINT,
    category      VARCHAR(20),
    ma20          DECIMAL(15,2),
    ma240         DECIMAL(15,2),
    PRIMARY KEY (date, code)
);

-- 하이퍼테이블로 변환 (1년 단위 자동 파티셔닝)
SELECT create_hypertable('kr_stock_daily', 'date',
    chunk_time_interval => INTERVAL '1 year',
    if_not_exists => TRUE
);

-- 미국 주식 일봉
CREATE TABLE IF NOT EXISTS us_stock_daily (
    date          DATE NOT NULL,
    ticker        VARCHAR(20) NOT NULL,
    name          VARCHAR(500) NOT NULL,
    open          DECIMAL(12,4),
    high          DECIMAL(12,4),
    low           DECIMAL(12,4),
    close         DECIMAL(12,4) NOT NULL,
    volume        BIGINT,
    change_rate   DECIMAL(10,4),
    market_cap    BIGINT,
    trading_value BIGINT,
    category      VARCHAR(30),
    ma20          DECIMAL(15,4),
    ma240         DECIMAL(15,4),
    PRIMARY KEY (date, ticker)
);

SELECT create_hypertable('us_stock_daily', 'date',
    chunk_time_interval => INTERVAL '1 year',
    if_not_exists => TRUE
);

-- ================================================
-- 2. 인덱스 (쿼리 성능 최적화)
-- ================================================
CREATE INDEX IF NOT EXISTS idx_kr_daily_code_date ON kr_stock_daily (code, date DESC);
CREATE INDEX IF NOT EXISTS idx_kr_daily_category  ON kr_stock_daily (date, category);
CREATE INDEX IF NOT EXISTS idx_kr_daily_date_tv   ON kr_stock_daily (date, trading_value DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_kr_daily_date_cr   ON kr_stock_daily (date, change_rate DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_us_daily_ticker_date ON us_stock_daily (ticker, date DESC);
CREATE INDEX IF NOT EXISTS idx_us_daily_category  ON us_stock_daily (date, category);
CREATE INDEX IF NOT EXISTS idx_us_daily_date_tv   ON us_stock_daily (date, trading_value DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_us_daily_date_cr   ON us_stock_daily (date, change_rate DESC NULLS LAST);

-- ================================================
-- 3. 압축 정책 (90일 이전 데이터 자동 압축, 디스크 70~90% 절약)
-- ================================================
ALTER TABLE kr_stock_daily SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'code',
    timescaledb.compress_orderby = 'date DESC'
);
SELECT add_compression_policy('kr_stock_daily', INTERVAL '90 days', if_not_exists => TRUE);

ALTER TABLE us_stock_daily SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'ticker',
    timescaledb.compress_orderby = 'date DESC'
);
SELECT add_compression_policy('us_stock_daily', INTERVAL '90 days', if_not_exists => TRUE);

-- ================================================
-- 4. Continuous Aggregate (주봉 자동 캐싱)
-- ================================================

-- 한국 주식 주봉
CREATE MATERIALIZED VIEW IF NOT EXISTS kr_stock_weekly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 week', date) AS week,
    code,
    first(name, date)    AS name,
    first(open, date)    AS open,
    max(high)            AS high,
    min(low)             AS low,
    last(close, date)    AS close,
    sum(volume)          AS volume,
    sum(trading_value)   AS trading_value
FROM kr_stock_daily
GROUP BY week, code
WITH NO DATA;

SELECT add_continuous_aggregate_policy('kr_stock_weekly',
    start_offset    => INTERVAL '4 weeks',
    end_offset      => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- 미국 주식 주봉
CREATE MATERIALIZED VIEW IF NOT EXISTS us_stock_weekly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 week', date) AS week,
    ticker,
    first(name, date)    AS name,
    first(open, date)    AS open,
    max(high)            AS high,
    min(low)             AS low,
    last(close, date)    AS close,
    sum(volume)          AS volume,
    sum(trading_value)   AS trading_value
FROM us_stock_daily
GROUP BY week, ticker
WITH NO DATA;

SELECT add_continuous_aggregate_policy('us_stock_weekly',
    start_offset    => INTERVAL '4 weeks',
    end_offset      => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE
);

-- ================================================
-- 5. 시장 지표 테이블 (지수/원자재/환율/암호화폐)
-- ================================================

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

-- ================================================
-- 6. 보조 데이터 테이블
-- ================================================

-- 기업 개요
CREATE TABLE IF NOT EXISTS stock_overview (
    code        VARCHAR(20) NOT NULL,
    market      VARCHAR(5) NOT NULL,       -- 'kr' 또는 'us'
    name        VARCHAR(200),
    sector      VARCHAR(200),
    industry    VARCHAR(200),
    description TEXT,
    market_cap  BIGINT,
    per         DECIMAL(10,2),
    eps         DECIMAL(15,2),
    updated_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (code, market)
);

-- 실적 데이터
CREATE TABLE IF NOT EXISTS stock_earnings (
    code             VARCHAR(20) NOT NULL,
    market           VARCHAR(5) NOT NULL,
    fiscal_date      DATE NOT NULL,
    revenue          BIGINT,
    revenue_estimate BIGINT,
    revenue_surprise DECIMAL(20,4),
    eps              NUMERIC,          -- KR: 영업이익(조 단위 KRW), US: EPS($)
    eps_estimate     NUMERIC,          -- KR: 영업이익 예상, US: EPS 예상
    eps_surprise     DECIMAL(20,4),
    PRIMARY KEY (code, market, fiscal_date)
);

-- 매핑
CREATE TABLE IF NOT EXISTS mapping (
    code        VARCHAR(20) NOT NULL,
    market      VARCHAR(5) NOT NULL,
    code   VARCHAR(50),
    PRIMARY KEY (code, market)
);

-- ================================================
-- 6. 사용자 데이터 (Google OAuth)
-- ================================================

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    google_id     VARCHAR(100) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL,
    name          VARCHAR(200),
    picture_url   VARCHAR(500),
    role          VARCHAR(20) DEFAULT 'user',    -- 'user' | 'premium' | 'admin'
    created_at    TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_folders (
    id          VARCHAR(50) NOT NULL,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS user_favorites (
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    folder_id   VARCHAR(50) NOT NULL,
    code        VARCHAR(20) NOT NULL,
    name        VARCHAR(200),
    market      VARCHAR(5) NOT NULL,
    sort_order  INTEGER DEFAULT 0,
    added_date  DATE DEFAULT CURRENT_DATE,
    PRIMARY KEY (user_id, folder_id, code, market)
);

CREATE TABLE IF NOT EXISTS user_memos (
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    code        VARCHAR(20) NOT NULL,
    market      VARCHAR(5) NOT NULL,
    content     TEXT,
    updated_at  TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, code, market)
);