"""
주식 데이터 관리 클래스 (한국/미국 공통) - asyncpg 기반 + Redis 캐싱
"""
import json as _json
from collections import OrderedDict
from datetime import datetime, date as date_type, timedelta
from typing import Literal, Optional


class StockDataManager:
    """주식 데이터 관리 클래스 (asyncpg pool 기반 + Redis 캐싱)"""

    CACHE_TTL = 7200  # 2시간 (안전망, 실제로는 수집 스크립트가 패턴 삭제)

    def __init__(self, market: Literal['kr', 'us'], db_pool, redis=None):
        self.market = market
        self.pool = db_pool
        self.redis = redis
        self.table = 'kr_stock_daily' if market == 'kr' else 'us_stock_daily'
        self.code_col = 'code' if market == 'kr' else 'ticker'
        # 프론트엔드 Korean key
        self._code_key = '종목코드' if market == 'kr' else '티커'

    async def _cache_get(self, key: str):
        """Redis에서 캐시된 결과 조회"""
        if not self.redis:
            return None
        try:
            data = await self.redis.get(key)
            return _json.loads(data) if data else None
        except Exception:
            return None

    async def _cache_set(self, key: str, value):
        """Redis에 결과 캐싱"""
        if not self.redis:
            return
        try:
            await self.redis.set(key, _json.dumps(value, ensure_ascii=False, default=str), ex=self.CACHE_TTL)
        except Exception:
            pass

    # --- 내부 유틸 ---

    def _parse_date(self, date_str: str):
        """날짜 문자열 → datetime.date 객체 (asyncpg 파라미터용)"""
        return datetime.strptime(date_str, '%Y-%m-%d').date()

    def _to_float(self, v) -> Optional[float]:
        if v is None:
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    def _to_int(self, v) -> int:
        if v is None:
            return 0
        try:
            return int(v)
        except (TypeError, ValueError):
            return 0

    def _make_record(self, row) -> dict:
        """asyncpg Record → 프론트엔드 Korean-keyed dict (일봉 데이터용)"""
        d = dict(row)
        date_val = d['date']
        date_str = date_val.strftime('%Y-%m-%d') if hasattr(date_val, 'strftime') else str(date_val)

        close = self._to_float(d.get('close')) or 0.0
        if self.market == 'us':
            close_val = round(close, 4)
            open_val  = round(self._to_float(d.get('open'))  or 0.0, 4)
            high_val  = round(self._to_float(d.get('high'))  or 0.0, 4)
            low_val   = round(self._to_float(d.get('low'))   or 0.0, 4)
        else:
            close_val = int(close)
            open_val  = int(self._to_float(d.get('open'))  or 0)
            high_val  = int(self._to_float(d.get('high'))  or 0)
            low_val   = int(self._to_float(d.get('low'))   or 0)

        ma20  = self._to_float(d.get('ma20'))
        ma240 = self._to_float(d.get('ma240'))

        return {
            '날짜': date_str,
            self._code_key: d[self.code_col],
            '종목명': d.get('name', ''),
            '시가': open_val,
            '고가': high_val,
            '저가': low_val,
            '종가': close_val,
            '거래량': self._to_int(d.get('volume')),
            '거래대금': self._to_int(d.get('trading_value')),
            '전일대비변동률(%)': self._to_float(d.get('change_rate')) or 0.0,
            'ma20':  round(ma20,  4) if ma20  is not None else None,
            'ma240': round(ma240, 4) if ma240 is not None else None,
        }

    def _ma240_pos(self, close, ma240) -> Optional[str]:
        """종가와 MA240 비교 → 'above' / 'below' / None"""
        if ma240 is None:
            return None
        ma240_f = float(ma240)
        if ma240_f <= 0:
            return None
        return 'above' if float(close) >= ma240_f else 'below'

    def _price_filter_sql(self, category: str) -> str:
        """미국주식 카테고리별 가격대 SQL 조건"""
        if category.startswith('high_price'):
            return 'AND close >= 10'
        if category.startswith('mid_price'):
            return 'AND close >= 5 AND close < 10'
        if category.startswith('low_price'):
            return 'AND close < 5'
        return ''

    def _sort_col_sql(self, category: str) -> str:
        """카테고리별 정렬 기준 컬럼"""
        if category.endswith('_rate') or category == 'change_rate':
            return 'change_rate'
        return 'trading_value'

    # --- 공개 API ---

    async def get_available_dates(self) -> dict:
        """사용 가능한 날짜 목록과 범위 정보를 반환합니다."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT DISTINCT date FROM {self.table} ORDER BY date DESC"
            )
        dates = [r['date'].strftime('%Y-%m-%d') for r in rows]
        if not dates:
            now = datetime.now()
            return {
                'dates': [],
                'initial_year': now.year,
                'initial_month': now.month,
                'min_year': now.year,
                'max_year': now.year,
            }
        max_d = datetime.strptime(dates[0], '%Y-%m-%d')
        min_d = datetime.strptime(dates[-1], '%Y-%m-%d')
        return {
            'dates': dates,
            'initial_year': max_d.year,
            'initial_month': max_d.month,
            'min_year': min_d.year,
            'max_year': max_d.year,
        }

    async def get_kr_day_data(self, date_str: str) -> dict:
        """한국주식: 특정 날짜의 데이터를 반환합니다."""
        cache_key = f"kr:day:{date_str}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return cached

        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        async with self.pool.acquire() as conn:
            rows_tv = await conn.fetch(
                """SELECT date, code, name, open, high, low, close, volume,
                          change_rate, trading_value, ma20, ma240
                   FROM kr_stock_daily
                   WHERE date = $1 AND change_rate >= 3.0
                   ORDER BY trading_value DESC NULLS LAST
                   LIMIT 300""",
                date_obj
            )
            rows_cr = await conn.fetch(
                """SELECT date, code, name, open, high, low, close, volume,
                          change_rate, trading_value, ma20, ma240
                   FROM kr_stock_daily
                   WHERE date = $1
                   ORDER BY change_rate DESC NULLS LAST
                   LIMIT 300""",
                date_obj
            )
        result = {
            'trading_value': [self._make_record(r) for r in rows_tv],
            'change_rate':   [self._make_record(r) for r in rows_cr],
        }
        await self._cache_set(cache_key, result)
        return result

    async def get_us_day_data(self, date_str: str) -> dict:
        """미국주식: 특정 날짜의 가격대별 데이터를 반환합니다."""
        cache_key = f"us:day:{date_str}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return cached

        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        sel = ("SELECT date, ticker, name, open, high, low, close, volume, "
               "change_rate, trading_value, ma20, ma240 "
               "FROM us_stock_daily WHERE date = $1")
        async with self.pool.acquire() as conn:
            rows_hv = await conn.fetch(
                f"{sel} AND close >= 10 AND change_rate >= 3.0"
                " ORDER BY trading_value DESC NULLS LAST LIMIT 300", date_obj)
            rows_hr = await conn.fetch(
                f"{sel} AND close >= 10"
                " ORDER BY change_rate DESC NULLS LAST LIMIT 300", date_obj)
            rows_mv = await conn.fetch(
                f"{sel} AND close >= 5 AND close < 10 AND change_rate >= 3.0"
                " ORDER BY trading_value DESC NULLS LAST LIMIT 300", date_obj)
            rows_mr = await conn.fetch(
                f"{sel} AND close >= 5 AND close < 10"
                " ORDER BY change_rate DESC NULLS LAST LIMIT 300", date_obj)
            rows_lv = await conn.fetch(
                f"{sel} AND close < 5 AND change_rate >= 3.0"
                " ORDER BY trading_value DESC NULLS LAST LIMIT 300", date_obj)
            rows_lr = await conn.fetch(
                f"{sel} AND close < 5"
                " ORDER BY change_rate DESC NULLS LAST LIMIT 300", date_obj)
        result = {
            'high_price_volume': [self._make_record(r) for r in rows_hv],
            'high_price_rate':   [self._make_record(r) for r in rows_hr],
            'mid_price_volume':  [self._make_record(r) for r in rows_mv],
            'mid_price_rate':    [self._make_record(r) for r in rows_mr],
            'low_price_volume':  [self._make_record(r) for r in rows_lv],
            'low_price_rate':    [self._make_record(r) for r in rows_lr],
        }
        await self._cache_set(cache_key, result)
        return result

    @staticmethod
    def _aggregate_rows(rows: list, interval: str) -> list[dict]:
        """일봉 데이터를 주봉/월봉으로 집계 + 집계 봉 기준 MA 재계산"""
        buckets: OrderedDict = OrderedDict()
        for r in rows:
            d = r['date']
            if interval == 'weekly':
                key = d - timedelta(days=d.weekday())  # 월요일 기준
            else:  # monthly
                key = d.replace(day=1)

            if key not in buckets:
                buckets[key] = {
                    'date': d,
                    'open': r['open'],
                    'high': r['high'],
                    'low': r['low'],
                    'close': r['close'],
                    'trading_value': r['trading_value'] or 0,
                }
            else:
                b = buckets[key]
                b['date'] = d  # 마지막 거래일로 갱신
                h = r['high']
                if h is not None:
                    b['high'] = max(float(b['high'] or 0), float(h))
                lo = r['low']
                if lo is not None:
                    cur_low = float(b['low']) if b['low'] is not None else float('inf')
                    b['low'] = min(cur_low, float(lo))
                b['close'] = r['close']
                b['trading_value'] = (b['trading_value'] or 0) + (r['trading_value'] or 0)

        result = list(buckets.values())

        # 집계된 봉 기준으로 MA20/MA240 재계산
        closes = [float(b['close']) for b in result]
        for i, b in enumerate(result):
            if i >= 19:
                b['ma20'] = sum(closes[i - 19:i + 1]) / 20
            else:
                b['ma20'] = None
            if i >= 239:
                b['ma240'] = sum(closes[i - 239:i + 1]) / 240
            else:
                b['ma240'] = None

        return result

    async def get_stock_history(self, stock_code: str, days: int = 90,
                                end_date: str = None,
                                interval: str = 'daily') -> dict:
        """특정 종목의 과거 차트 데이터 반환 (DB 사전계산 MA 사용)"""
        empty = {
            'line': [], 'candle': [], 'volume': [],
            'change': {}, 'ma20': [], 'ma240': [], 'end_date': end_date
        }
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT date, open, high, low, close, trading_value, "
                f"change_rate, ma20, ma240 "
                f"FROM {self.table} WHERE {self.code_col} = $1 ORDER BY date ASC",
                stock_code
            )
        if not rows:
            return empty

        all_rows = list(rows)

        # 주봉/월봉 집계
        if interval in ('weekly', 'monthly'):
            all_rows = self._aggregate_rows(all_rows, interval)

        # 표시 범위 결정
        if end_date:
            end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
            before = [r for r in all_rows if r['date'] <= end_dt]
            start_dt = before[-days]['date'] if len(before) > days else all_rows[0]['date']
            display = [r for r in all_rows if r['date'] >= start_dt]
        else:
            display = all_rows[-days:] if len(all_rows) > days else all_rows

        decimal_places = 2 if self.market == 'us' else 0
        line_data, candle_data, volume_data = [], [], []
        ma20_data, ma240_data = [], []
        change_data: dict = {}
        prev_close = None

        for row in display:
            date_str = row['date'].strftime('%Y-%m-%d')
            close  = float(row['close'])
            open_p = float(row['open'])  if row['open']  is not None else 0.0
            high_p = float(row['high'])  if row['high']  is not None else 0.0
            low_p  = float(row['low'])   if row['low']   is not None else 0.0
            tv     = float(row['trading_value']) if row['trading_value'] is not None else 0.0

            is_suspended = (open_p == 0.0)

            change_pct = ((close - prev_close) / prev_close * 100
                          if prev_close else 0.0)
            change_data[date_str] = round(change_pct, 2)

            line_data.append({'time': date_str, 'value': close})

            if not is_suspended:
                candle_data.append({
                    'time': date_str,
                    'open': open_p, 'high': high_p, 'low': low_p, 'close': close
                })

            vol_color = ('#6B728080' if is_suspended
                         else ('#EF535080' if close >= (prev_close or close)
                               else '#2196F380'))
            volume_data.append({'time': date_str, 'value': tv, 'color': vol_color})

            if row['ma20'] is not None:
                ma20_data.append({
                    'time': date_str,
                    'value': round(float(row['ma20']), decimal_places)
                })
            if row['ma240'] is not None:
                ma240_data.append({
                    'time': date_str,
                    'value': round(float(row['ma240']), decimal_places)
                })

            prev_close = close

        return {
            'line': line_data, 'candle': candle_data, 'volume': volume_data,
            'change': change_data, 'ma20': ma20_data, 'ma240': ma240_data,
            'end_date': end_date
        }

    async def get_stock_overview(self, stock_code: str) -> dict:
        """특정 종목의 기업개요를 반환합니다."""
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT industry, description FROM stock_overview "
                "WHERE code = $1 AND market = $2",
                stock_code, self.market
            )
        if row is None:
            return {'ticker': stock_code, 'industry': '', 'overview': ''}
        return {
            'ticker': stock_code,
            'industry': row['industry'] or '',
            'overview': row['description'] or '',
        }

    async def get_stock_earnings(self, stock_code: str) -> list[dict]:
        """특정 종목의 실적 데이터를 반환합니다."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT fiscal_date, revenue, revenue_estimate, revenue_surprise, "
                "eps, eps_estimate, eps_surprise "
                "FROM stock_earnings WHERE code = $1 AND market = $2 "
                "ORDER BY fiscal_date DESC",
                stock_code, self.market
            )
        result = []
        for row in rows:
            period    = row['fiscal_date'].strftime('%Y-%m')
            rev       = int(row['revenue']) if row['revenue'] is not None else None
            rev_est   = int(row['revenue_estimate']) if row['revenue_estimate'] is not None else None
            rev_surp  = self._to_float(row['revenue_surprise'])
            eps       = self._to_float(row['eps'])
            eps_est   = self._to_float(row['eps_estimate'])
            eps_surp  = self._to_float(row['eps_surprise'])

            if self.market == 'kr':
                item = {
                    '종목코드': stock_code,
                    '분기': period,
                    '매출': rev, '매출예상': rev_est, '매출서프라이즈': rev_surp,
                    '영업이익': eps, '영업이익예상': eps_est, '영업이익서프라이즈': eps_surp,
                }
            else:
                item = {
                    '티커': stock_code,
                    '분기': period,
                    'EPS': eps, 'EPS예상': eps_est, 'EPS서프라이즈': eps_surp,
                    '매출': rev, '매출예상': rev_est, '매출서프라이즈': rev_surp,
                }
            result.append(item)
        return result

    async def get_stock_financials(self, stock_code: str) -> list[dict]:
        """특정 종목의 재무제표 데이터를 반환합니다."""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT fiscal_date, period_type, "
                "revenue, gross_profit, operating_income, net_income, eps, "
                "total_assets, total_liabilities, total_equity, "
                "cash_from_operating, cash_from_investing, cash_from_financing, "
                "currency "
                "FROM stock_financials WHERE code = $1 AND UPPER(market) = $2 "
                "ORDER BY fiscal_date DESC, period_type DESC",
                stock_code, self.market.upper()
            )
        result = []
        for row in rows:
            item = {
                'fiscal_date': row['fiscal_date'].strftime('%Y-%m-%d'),
                'period_type': row['period_type'],
                'revenue': int(row['revenue']) if row['revenue'] is not None else None,
                'gross_profit': int(row['gross_profit']) if row['gross_profit'] is not None else None,
                'operating_income': int(row['operating_income']) if row['operating_income'] is not None else None,
                'net_income': int(row['net_income']) if row['net_income'] is not None else None,
                'eps': self._to_float(row['eps']),
                'total_assets': int(row['total_assets']) if row['total_assets'] is not None else None,
                'total_liabilities': int(row['total_liabilities']) if row['total_liabilities'] is not None else None,
                'total_equity': int(row['total_equity']) if row['total_equity'] is not None else None,
                'cash_from_operating': int(row['cash_from_operating']) if row['cash_from_operating'] is not None else None,
                'cash_from_investing': int(row['cash_from_investing']) if row['cash_from_investing'] is not None else None,
                'cash_from_financing': int(row['cash_from_financing']) if row['cash_from_financing'] is not None else None,
                'currency': row['currency'],
            }
            result.append(item)
        return result

    async def search_stocks(self, query: str, limit: int = 50) -> list[dict]:
        """종목 검색 (관련도순 정렬)"""
        if not query:
            return []
        q = query.strip().upper()
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"""SELECT DISTINCT {self.code_col} AS code, name
                    FROM {self.table}
                    WHERE UPPER({self.code_col}) LIKE $1 OR UPPER(name) LIKE $1
                    ORDER BY
                        CASE
                            WHEN UPPER({self.code_col}) = $2          THEN 1
                            WHEN UPPER({self.code_col}) LIKE $3        THEN 2
                            WHEN UPPER(name)            LIKE $3        THEN 3
                            ELSE 4
                        END,
                        {self.code_col}
                    LIMIT $4""",
                f'%{q}%', q, f'{q}%', limit
            )
        return [{'code': r['code'], 'name': r['name']} for r in rows]

    async def get_all_tickers(self) -> list[dict]:
        """전체 종목 목록 반환 (code + name)"""
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                f"SELECT DISTINCT {self.code_col} AS code, name "
                f"FROM {self.table} ORDER BY {self.code_col}"
            )
        return [{'code': r['code'], 'name': r['name']} for r in rows]

    async def get_frequent_stocks(self, base_date: str, weeks: int,
                                  category: str) -> list[dict]:
        """기간별 빈출 종목 상위 100개 반환"""
        cache_key = f"{self.market}:frequent:{base_date}:{weeks}:{category}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return cached

        base_date = self._parse_date(base_date)
        business_days = weeks * 5
        price_filter = self._price_filter_sql(category)
        sort_col     = self._sort_col_sql(category)
        rate_cond    = "AND change_rate >= 3.0" if sort_col == 'trading_value' else ""

        query = f"""
        WITH business_days AS (
            SELECT DISTINCT date FROM {self.table}
            WHERE date <= $1::date
            ORDER BY date DESC
            LIMIT $2
        ),
        daily_ranked AS (
            SELECT {self.code_col} AS code, name,
                   ROW_NUMBER() OVER (
                       PARTITION BY date
                       ORDER BY {sort_col} DESC NULLS LAST
                   ) AS rn
            FROM {self.table}
            WHERE date IN (SELECT date FROM business_days)
              {rate_cond} {price_filter}
        ),
        top300 AS (
            SELECT code, name FROM daily_ranked WHERE rn <= 300
        ),
        freq AS (
            SELECT code, name, COUNT(*) AS cnt FROM top300 GROUP BY code, name
        ),
        latest_date AS (
            SELECT MAX(date) AS d FROM business_days
        ),
        period_count AS (
            SELECT COUNT(DISTINCT date) AS cnt FROM business_days
        ),
        latest_vals AS (
            SELECT {self.code_col} AS code, trading_value, close, ma240
            FROM {self.table}
            WHERE date = (SELECT d FROM latest_date)
        )
        SELECT f.code, f.name, f.cnt AS freq_cnt,
               COALESCE(lv.trading_value, 0) AS latest_tv,
               lv.close, lv.ma240,
               (SELECT cnt FROM period_count) AS period_days
        FROM freq f
        LEFT JOIN latest_vals lv ON lv.code = f.code
        ORDER BY f.cnt DESC, COALESCE(lv.trading_value, 0) DESC
        LIMIT 100
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, base_date, business_days)

        result = []
        for rank, row in enumerate(rows, 1):
            result.append({
                '순위': rank,
                self._code_key: row['code'],
                '종목명': row['name'],
                '등장횟수': row['freq_cnt'],
                '기간영업일수': row['period_days'],
                '최근거래대금': int(row['latest_tv'] or 0),
                'ma240_position': (self._ma240_pos(row['close'], row['ma240'])
                                   if row['close'] is not None else None),
            })
        await self._cache_set(cache_key, result)
        return result

    async def get_pullback_stocks(self, base_date: str, days_ago: int,
                                  category: str) -> list[dict]:
        """n일 전 상위 300개 중 오늘 하락 마감한 종목 반환"""
        cache_key = f"{self.market}:pullback:{base_date}:{days_ago}:{category}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return cached

        base_date = self._parse_date(base_date)
        price_filter = self._price_filter_sql(category)
        sort_col     = self._sort_col_sql(category)
        rate_cond    = "AND change_rate >= 3.0" if sort_col == 'trading_value' else ""
        order_sql    = f"{sort_col} DESC NULLS LAST"

        # 단일 쿼리로 합침: CTE로 영업일 → 과거 top300 → 오늘 하락 필터
        query = f"""
        WITH biz_dates AS (
            SELECT DISTINCT date FROM {self.table}
            WHERE date <= $1::date ORDER BY date DESC LIMIT $2
        ),
        date_range AS (
            SELECT MIN(date) AS first_d, MAX(date) AS last_d FROM biz_dates
        ),
        sorted_dates AS (
            SELECT date, ROW_NUMBER() OVER (ORDER BY date DESC) AS rn
            FROM biz_dates
        ),
        past_date AS (
            SELECT date AS d FROM sorted_dates WHERE rn = $2 - 1
        ),
        past_top300 AS (
            SELECT {self.code_col} AS code FROM {self.table}
            WHERE date = (SELECT d FROM past_date)
              {rate_cond} {price_filter}
            ORDER BY {sort_col} DESC NULLS LAST LIMIT 300
        )
        SELECT t.{self.code_col} AS code, t.name, t.close, t.change_rate,
               t.trading_value, t.ma240,
               (SELECT d FROM past_date) AS past_d
        FROM {self.table} t
        INNER JOIN past_top300 p ON t.{self.code_col} = p.code
        WHERE t.date = (SELECT last_d FROM date_range)
          AND t.change_rate < 0
        ORDER BY {order_sql}
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, base_date, days_ago + 2)

        if not rows:
            return []

        past_d = rows[0]['past_d']
        result = []
        for rank, row in enumerate(rows, 1):
            close = float(row['close'])
            result.append({
                '순위': rank,
                self._code_key: row['code'],
                '종목명': row['name'],
                '전일대비변동률': round(float(row['change_rate'] or 0), 2),
                '종가': round(close, 2) if self.market == 'us' else int(close),
                '거래대금': int(row['trading_value'] or 0),
                '기준일': past_d.strftime('%Y-%m-%d'),
                'ma240_position': self._ma240_pos(row['close'], row['ma240']),
            })
        await self._cache_set(cache_key, result)
        return result

    async def get_consecutive_rise_stocks(self, base_date: str,
                                          consecutive_days: int,
                                          category: str) -> list[dict]:
        """n일 연속 상승한 종목 반환 (첫 날은 top300 필터 적용, SQL 윈도우 함수 사용)"""
        cache_key = f"{self.market}:consecutive:{base_date}:{consecutive_days}:{category}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return cached

        base_date = self._parse_date(base_date)
        sort_col     = self._sort_col_sql(category)
        price_filter = self._price_filter_sql(category)
        rate_cond    = "AND change_rate >= 3.0" if sort_col == 'trading_value' else ""

        # 단일 SQL: 영업일 구하기 → 첫날 top300 → N일 연속 상승 카운트
        query = f"""
        WITH biz_dates AS (
            SELECT DISTINCT date FROM {self.table}
            WHERE date <= $1::date ORDER BY date DESC LIMIT $2
        ),
        first_date AS (
            SELECT MIN(date) AS d FROM biz_dates
        ),
        last_date AS (
            SELECT MAX(date) AS d FROM biz_dates
        ),
        first_day_top300 AS (
            SELECT {self.code_col} AS code
            FROM {self.table}
            WHERE date = (SELECT d FROM first_date)
              {rate_cond} {price_filter}
            ORDER BY {sort_col} DESC NULLS LAST
            LIMIT 300
        ),
        target_data AS (
            SELECT t.date, t.{self.code_col} AS code, t.name,
                   t.close, t.change_rate, t.trading_value, t.ma240
            FROM {self.table} t
            INNER JOIN first_day_top300 f ON t.{self.code_col} = f.code
            WHERE t.date IN (SELECT date FROM biz_dates)
        ),
        rise_count AS (
            SELECT code,
                   COUNT(*) FILTER (WHERE change_rate > 0) AS rise_days,
                   COUNT(*) AS total_days
            FROM target_data
            GROUP BY code
            HAVING COUNT(*) FILTER (WHERE change_rate > 0) = COUNT(*)
        )
        SELECT td.code, td.name, td.close, td.change_rate,
               td.trading_value, td.ma240
        FROM target_data td
        INNER JOIN rise_count rc ON td.code = rc.code
        WHERE td.date = (SELECT d FROM last_date)
        ORDER BY {sort_col} DESC NULLS LAST
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, base_date, consecutive_days)

        result = []
        for rank, row in enumerate(rows, 1):
            close = float(row['close'])
            result.append({
                '순위': rank,
                self._code_key: row['code'],
                '종목명': row['name'],
                '전일대비변동률': round(float(row['change_rate'] or 0), 2),
                '종가': round(close, 2) if self.market == 'us' else int(close),
                '거래대금': int(row['trading_value'] or 0),
                '연속일수': consecutive_days,
                'ma240_position': self._ma240_pos(row['close'], row['ma240']),
            })
        await self._cache_set(cache_key, result)
        return result

    async def get_52week_high_stocks(self, base_date: str,
                                     consolidation_days: int = 0,
                                     range_pct: float = 0.0,
                                     category: str = 'trading_value') -> list[dict]:
        """처음으로 52주 신고가를 달성한 종목 반환
        (전날은 아니었다가 당일 처음 달성, 상승률 5% 이상)
        2단계 분리: 오늘/어제만 가져온 뒤 해당 종목의 1년 MAX(close) 별도 조회"""
        cache_key = f"{self.market}:52week:{base_date}:{consolidation_days}:{range_pct}:{category}"
        cached = await self._cache_get(cache_key)
        if cached is not None:
            return cached

        base_date = self._parse_date(base_date)
        price_filter = self._price_filter_sql(category)
        sort_col     = self._sort_col_sql(category)

        # 1단계: 오늘 + 어제 데이터만 가져옴 (가벼움)
        query_today = f"""
        WITH prev_date AS (
            SELECT MAX(date) AS d FROM {self.table}
            WHERE date < $1::date AND date >= $1::date - INTERVAL '7 days'
        )
        SELECT date, {self.code_col} AS code, name,
               close, change_rate, trading_value, ma240
        FROM {self.table}
        WHERE (date = $1::date OR date = (SELECT d FROM prev_date))
          AND change_rate IS NOT NULL
        """
        async with self.pool.acquire() as conn:
            all_rows = await conn.fetch(query_today, base_date)

        if not all_rows:
            return []

        # 오늘/어제 분리
        today_rows = [r for r in all_rows if r['date'] == base_date]
        yesterday_rows = [r for r in all_rows if r['date'] != base_date]

        # 오늘 5% 이상 상승 + 가격대 필터
        def passes_price_filter(r):
            close = float(r['close'] or 0)
            if category.startswith('high_price') and close < 10:
                return False
            if category.startswith('mid_price') and not (5 <= close < 10):
                return False
            if category.startswith('low_price') and close >= 5:
                return False
            return True

        today_candidates = [r for r in today_rows
                            if float(r['change_rate'] or 0) >= 5.0
                            and passes_price_filter(r)]

        if not today_candidates:
            return []

        # 2단계: 후보 종목의 1년 MAX(close) 조회 (오늘 제외)
        candidate_codes = [r['code'] for r in today_candidates]
        async with self.pool.acquire() as conn:
            max_rows = await conn.fetch(
                f"SELECT {self.code_col} AS code, MAX(close) AS year_high "
                f"FROM {self.table} "
                f"WHERE {self.code_col} = ANY($1) "
                f"  AND date >= $2::date - INTERVAL '1 year' "
                f"  AND date < $2::date "
                f"GROUP BY {self.code_col}",
                candidate_codes, base_date
            )
        year_high_map = {r['code']: float(r['year_high']) for r in max_rows}

        # 어제도 신고가였던 종목 제외
        yesterday_codes = set()
        if yesterday_rows:
            yesterday_code_set = {r['code'] for r in yesterday_rows}
            # 어제 종목의 1년 MAX(close) (어제 제외)
            yesterday_date = yesterday_rows[0]['date']
            yesterday_candidates = [r['code'] for r in yesterday_rows
                                    if r['code'] in set(candidate_codes)]
            if yesterday_candidates:
                async with self.pool.acquire() as conn:
                    ymax_rows = await conn.fetch(
                        f"SELECT {self.code_col} AS code, MAX(close) AS year_high "
                        f"FROM {self.table} "
                        f"WHERE {self.code_col} = ANY($1) "
                        f"  AND date >= $2::date - INTERVAL '1 year' "
                        f"  AND date < $2::date "
                        f"GROUP BY {self.code_col}",
                        yesterday_candidates, yesterday_date
                    )
                y_high_map = {r['code']: float(r['year_high']) for r in ymax_rows}
                for r in yesterday_rows:
                    if r['code'] in y_high_map:
                        if float(r['close']) >= y_high_map[r['code']]:
                            yesterday_codes.add(r['code'])

        # 최종 필터: 오늘 종가 >= 1년 최고가 AND 어제는 아님
        rows = []
        for r in today_candidates:
            code = r['code']
            if code in yesterday_codes:
                continue
            yh = year_high_map.get(code)
            if yh is not None and float(r['close']) >= yh:
                rows.append(r)

        if not rows:
            return []

        # 횡보 필터 (Python)
        if consolidation_days > 0 and range_pct > 0:
            filter_codes = [r['code'] for r in rows]
            async with self.pool.acquire() as conn:
                biz_rows = await conn.fetch(
                    f"SELECT DISTINCT date FROM {self.table} "
                    f"WHERE date < $1::date ORDER BY date DESC LIMIT $2",
                    base_date, consolidation_days
                )
            if len(biz_rows) >= 2:
                w_start = min(r['date'] for r in biz_rows)
                w_end   = max(r['date'] for r in biz_rows)
                async with self.pool.acquire() as conn:
                    win_rows = await conn.fetch(
                        f"SELECT {self.code_col} AS code, "
                        f"MAX(close) AS max_c, MIN(close) AS min_c "
                        f"FROM {self.table} "
                        f"WHERE {self.code_col} = ANY($1) "
                        f"  AND date >= $2 AND date <= $3 "
                        f"GROUP BY {self.code_col}",
                        filter_codes, w_start, w_end
                    )
                passed = set()
                for wr in win_rows:
                    mn = float(wr['min_c'] or 0)
                    if mn > 0:
                        rng = (float(wr['max_c']) - mn) / mn * 100
                        if rng <= range_pct:
                            passed.add(wr['code'])
                rows = [r for r in rows if r['code'] in passed]

        # 정렬
        rows.sort(key=lambda r: float(r[sort_col] or 0), reverse=True)

        result = []
        for rank, row in enumerate(rows, 1):
            close = float(row['close'])
            result.append({
                '순위': rank,
                self._code_key: row['code'],
                '종목명': row['name'],
                '전일대비변동률': round(float(row['change_rate'] or 0), 2),
                '종가': round(close, 2) if self.market == 'us' else int(close),
                '거래대금': int(row['trading_value'] or 0),
                'ma240_position': self._ma240_pos(row['close'], row['ma240']),
            })
        await self._cache_set(cache_key, result)
        return result

    async def get_gap_analysis(
        self,
        start_date: str,
        end_date: str,
        base_price: str,
        compare_price: str,
        min_rate: float,
        max_rate: float,
        extra_base: str = None,
        extra_compare: str = None,
        extra_direction: str = None,
        detail_base: str = None,
        detail_compare: str = None,
        detail_direction: str = None,
        ticker_filter: str = None,
        direction: str = 'up'
    ) -> list[dict]:
        """갭 상승/하락 분석 (3단계 필터)"""
        start_date = self._parse_date(start_date)
        end_date   = self._parse_date(end_date)
        params = [start_date, end_date]
        ticker_cond = ""
        if ticker_filter:
            params.append(f'%{ticker_filter.upper()}%')
            n = len(params)
            ticker_cond = (
                f"AND (UPPER({self.code_col}) LIKE ${n} "
                f"OR UPPER(name) LIKE ${n})"
            )

        query = f"""
        WITH windowed AS (
            SELECT date,
                   {self.code_col} AS code,
                   name,
                   open, high, low, close,
                   trading_value, change_rate, ma240,
                   LAG(close)  OVER (PARTITION BY {self.code_col} ORDER BY date) AS prev_close,
                   LEAD(open)  OVER (PARTITION BY {self.code_col} ORDER BY date) AS next_open,
                   LEAD(close) OVER (PARTITION BY {self.code_col} ORDER BY date) AS next_close,
                   close >= MAX(close) OVER (
                       PARTITION BY {self.code_col}
                       ORDER BY date
                       ROWS BETWEEN 251 PRECEDING AND CURRENT ROW
                   ) AS is_52week_high
            FROM {self.table}
            WHERE date >= $1::date - INTERVAL '1 year'
              AND date <= $2::date + INTERVAL '7 days'
              {ticker_cond}
        )
        SELECT * FROM windowed
        WHERE date >= $1::date
          AND date <= $2::date
          AND prev_close IS NOT NULL
        ORDER BY date ASC, trading_value DESC NULLS LAST
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

        if not rows:
            return []

        # 가격 컬럼 매핑
        col_map = {
            'prev_close': 'prev_close',
            'open':       'open',
            'close':      'close',
            'next_open':  'next_open',
            'next_close': 'next_close',
        }
        base_col    = col_map.get(base_price,    'prev_close')
        compare_col = col_map.get(compare_price, 'open')

        result = []
        for row in rows:
            d = dict(row)

            base_val    = self._to_float(d.get(base_col))
            compare_val = self._to_float(d.get(compare_col))
            if base_val is None or compare_val is None or base_val == 0:
                continue

            gap_rate = (compare_val - base_val) / base_val * 100

            # 1단계: 방향 + 범위
            if direction == 'down':
                eff_max = max_rate if max_rate < 99999 else float('inf')
                if not (-eff_max <= gap_rate <= -min_rate):
                    continue
            else:
                if not (min_rate <= gap_rate <= max_rate):
                    continue

            # 2단계: 추가 조건
            if extra_base and extra_compare and extra_direction:
                eb = self._to_float(d.get(col_map.get(extra_base, extra_base)))
                ec = self._to_float(d.get(col_map.get(extra_compare, extra_compare)))
                if eb is not None and ec is not None and eb != 0:
                    er = (ec - eb) / eb * 100
                    if extra_direction == 'up'   and er <= 0: continue
                    if extra_direction == 'down' and er >= 0: continue

            # 3단계: 세부 조건
            if detail_base and detail_compare and detail_direction:
                db_ = self._to_float(d.get(col_map.get(detail_base, detail_base)))
                dc_ = self._to_float(d.get(col_map.get(detail_compare, detail_compare)))
                if db_ is not None and dc_ is not None and db_ != 0:
                    dr = (dc_ - db_) / db_ * 100
                    if detail_direction == 'up'   and dr <= 0: continue
                    if detail_direction == 'down' and dr >= 0: continue

            close  = float(d['close'])
            ma240  = self._to_float(d.get('ma240'))
            result.append({
                '날짜':          d['date'].strftime('%Y-%m-%d'),
                '티커':          d['code'],
                '종목명':        d['name'],
                '종가':          round(close, 2),
                '등락률':        round(gap_rate, 2),
                '거래대금':      int(d['trading_value'] or 0),
                'ma240':         round(ma240, 2) if ma240 is not None else None,
                'ma240_position': self._ma240_pos(close, ma240),
                'is_52week_high': bool(d.get('is_52week_high', False)),
            })
        return result

    async def get_new_listings(self, start_date: str, end_date: str) -> list[dict]:
        """신규 상장 종목 조회 (DB 내 최초 거래일 기준)"""
        start_date = self._parse_date(start_date)
        end_date   = self._parse_date(end_date)
        query = f"""
        WITH first_dates AS (
            SELECT {self.code_col} AS code, MIN(date) AS first_date
            FROM {self.table}
            GROUP BY {self.code_col}
        )
        SELECT t.date, t.{self.code_col} AS code, t.name,
               t.open, t.close, t.change_rate, t.trading_value
        FROM {self.table} t
        INNER JOIN first_dates fd
            ON t.{self.code_col} = fd.code AND t.date = fd.first_date
        WHERE fd.first_date >= $1::date
          AND fd.first_date <= $2::date
        ORDER BY t.date ASC
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, start_date, end_date)

        result = []
        for row in rows:
            open_p  = float(row['open'])  if row['open']  is not None else 0.0
            close_p = float(row['close'])
            rate    = (close_p - open_p) / open_p * 100 if open_p > 0 else 0.0
            result.append({
                '날짜':   row['date'].strftime('%Y-%m-%d'),
                '티커':   str(row['code']),
                '종목명': str(row['name']),
                '시가':   open_p,
                '종가':   round(close_p, 2),
                '등락률': round(rate, 2),
                '거래대금': float(row['trading_value'] or 0),
            })
        return result
