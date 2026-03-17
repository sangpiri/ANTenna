"""
시장 지표 API 라우터
KOSPI, KOSDAQ, S&P500, NASDAQ, 달러인덱스, 금, 은, 구리, WTI, 비트코인, USD/KRW
"""
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

# DB 풀은 main.py에서 주입됨
db_pool = None

# 홈페이지 표시 순서 (공통 → 미국 → 한국)
DISPLAY_ORDER = [
    'GC=F', 'SI=F', 'HG=F', 'CL=F', 'BTC-USD',              # 공통 지표
    '^GSPC', '^IXIC', 'DX-Y.NYB',                             # 미국 지표
    'DFEDTARU', 'DGS3', 'DGS10', 'CPIAUCSL', 'UNRATE', 'GDPC1',  # 미국 거시경제
    '^KS11', '^KQ11', 'USDKRW=X',                             # 한국 지표
    'KR-BASE-RATE', 'KR-3Y', 'KR-10Y', 'KR-CPI', 'KR-UNRATE', 'KR-GDP',  # 한국 거시경제
]


def set_db_pool(pool):
    """DB 커넥션 풀 설정 (main.py에서 호출)"""
    global db_pool
    db_pool = pool


@router.get("/list")
async def get_indices_list():
    """11개 시장 지표 최신 요약 + 스파크라인(최근 6개월 종가) 반환"""
    if db_pool is None:
        return []

    async with db_pool.acquire() as conn:
        # 각 ticker의 최신 데이터 (날짜 내림차순 첫 번째)
        latest_rows = await conn.fetch("""
            SELECT DISTINCT ON (ticker)
                ticker, name, close, change_rate, open, high, low, date
            FROM market_indices
            ORDER BY ticker, date DESC
        """)

        # 스파크라인: 각 ticker 최근 6개월(약 126 거래일) 종가 (오래된 순 정렬)
        sparkline_rows = await conn.fetch("""
            SELECT ticker, close
            FROM (
                SELECT ticker, date, close,
                    ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY date DESC) AS rn
                FROM market_indices
            ) t
            WHERE rn <= 126
            ORDER BY ticker, date ASC
        """)

    # 스파크라인 데이터 집계
    sparklines: dict[str, list[float]] = {}
    for row in sparkline_rows:
        t = row['ticker']
        sparklines.setdefault(t, []).append(float(row['close']))

    # 결과 구성
    result_map: dict[str, dict] = {}
    for row in latest_rows:
        t = row['ticker']
        close_val = float(row['close'])
        result_map[t] = {
            'ticker': t,
            'name': row['name'],
            'close': close_val,
            'change_rate': float(row['change_rate']) if row['change_rate'] is not None else 0.0,
            'open': float(row['open']) if row['open'] is not None else close_val,
            'high': float(row['high']) if row['high'] is not None else close_val,
            'low': float(row['low']) if row['low'] is not None else close_val,
            'sparkline': sparklines.get(t, []),
            'date': row['date'].isoformat(),
        }

    # 정해진 순서대로 반환
    return [result_map[t] for t in DISPLAY_ORDER if t in result_map]


@router.get("/history/{ticker}")
async def get_index_history(
    ticker: str,
    interval: str = Query("daily", description="봉 간격 (daily/weekly/monthly)")
):
    """시장 지표 전체 OHLC + MA20/MA240 반환 (StockHistory 호환 포맷)"""
    if db_pool is None:
        return {
            'line': [], 'candle': [], 'volume': [],
            'change': {}, 'ma20': [], 'ma240': [], 'end_date': None,
        }

    if interval == 'weekly':
        bucket = "time_bucket('7 days', date)"
    elif interval == 'monthly':
        bucket = "time_bucket('30 days', date)"
    else:
        bucket = None

    if bucket:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(f"""
                WITH agg AS (
                    SELECT {bucket} AS bucket_date,
                        MAX(date) AS date,
                        first(open, date) AS open,
                        MAX(high) AS high,
                        MIN(low) AS low,
                        last(close, date) AS close,
                        SUM(volume) AS volume,
                        last(change_rate, date) AS change_rate
                    FROM market_indices
                    WHERE ticker = $1
                    GROUP BY bucket_date
                ),
                data AS (
                    SELECT date, open, high, low, close, volume, change_rate,
                        AVG(close) OVER (ORDER BY date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS ma20,
                        AVG(close) OVER (ORDER BY date ROWS BETWEEN 239 PRECEDING AND CURRENT ROW) AS ma240
                    FROM agg
                )
                SELECT * FROM data ORDER BY date ASC
            """, ticker)
    else:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch("""
                WITH data AS (
                    SELECT date, open, high, low, close, volume, change_rate,
                        AVG(close) OVER (ORDER BY date ROWS BETWEEN 19 PRECEDING AND CURRENT ROW) AS ma20,
                        AVG(close) OVER (ORDER BY date ROWS BETWEEN 239 PRECEDING AND CURRENT ROW) AS ma240
                    FROM market_indices
                    WHERE ticker = $1
                )
                SELECT * FROM data ORDER BY date ASC
            """, ticker)

    if not rows:
        raise HTTPException(status_code=404, detail="데이터 없음")

    line = []
    candle = []
    volume = []
    change: dict[str, float] = {}
    ma20 = []
    ma240 = []

    for row in rows:
        date_str = row['date'].isoformat()
        close_val = float(row['close'])
        open_val = float(row['open']) if row['open'] is not None else close_val
        high_val = float(row['high']) if row['high'] is not None else close_val
        low_val = float(row['low']) if row['low'] is not None else close_val

        line.append({'time': date_str, 'value': close_val})
        candle.append({
            'time': date_str,
            'open': open_val,
            'high': high_val,
            'low': low_val,
            'close': close_val,
        })

        if row['volume'] is not None:
            volume.append({
                'time': date_str,
                'value': float(row['volume']),
                'color': 'rgba(156, 163, 175, 0.4)',  # 기본값, 프론트에서 방향 기반으로 재계산
            })

        if row['change_rate'] is not None:
            change[date_str] = float(row['change_rate'])

        ma20.append({'time': date_str, 'value': round(float(row['ma20']), 4)})
        ma240.append({'time': date_str, 'value': round(float(row['ma240']), 4)})

    return {
        'line': line,
        'candle': candle,
        'volume': volume,
        'change': change,
        'ma20': ma20,
        'ma240': ma240,
        'end_date': rows[-1]['date'].isoformat(),
    }
