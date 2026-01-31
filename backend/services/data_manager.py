"""
주식 데이터 관리 클래스 (한국/미국 공통)
"""
import pandas as pd
from datetime import datetime
from pathlib import Path
import time
from typing import Literal


class StockDataManager:
    """주식 데이터 관리 클래스"""

    def __init__(self, market: Literal['kr', 'us']):
        self.market = market
        self.df = pd.DataFrame()
        self.min_year = datetime.now().year
        self.max_year = datetime.now().year
        self.initial_year = datetime.now().year
        self.initial_month = datetime.now().month

        # 시장별 컬럼 설정
        self.config = {
            'kr': {'code_col': '종목코드', 'name_col': '종목명'},
            'us': {'code_col': '티커', 'name_col': '종목명'}
        }[market]

    @property
    def code_col(self) -> str:
        return self.config['code_col']

    @property
    def name_col(self) -> str:
        return self.config['name_col']

    def load_data(self, file_path: str) -> None:
        """CSV 파일을 로드하고 데이터를 전처리합니다."""
        if not Path(file_path).exists():
            print(f"경고: {file_path} 파일을 찾을 수 없습니다.")
            return

        try:
            start_time = time.time()
            print(f"[{self.market.upper()}] CSV 파일 로딩 중...")

            df = pd.read_csv(file_path)
            print(f"    원본 데이터: {len(df):,}개 행")

            print("날짜 변환 중...")
            df['날짜'] = pd.to_datetime(df['날짜'], errors='coerce')
            df = df.dropna(subset=['날짜'])

            print("숫자 컬럼 변환 중...")
            df['전일대비변동률(%)'] = pd.to_numeric(df['전일대비변동률(%)'], errors='coerce').fillna(0)
            df['종가'] = pd.to_numeric(df['종가'], errors='coerce').fillna(0)
            df['거래대금'] = pd.to_numeric(df['거래대금'], errors='coerce').fillna(0)
            if '거래량' in df.columns:
                df['거래량'] = pd.to_numeric(df['거래량'], errors='coerce').fillna(0)

            self.df = df
            print(f"    최종 데이터: {len(self.df):,}개 행")

            if not self.df.empty:
                min_date = self.df['날짜'].min()
                max_date = self.df['날짜'].max()
                self.min_year = min_date.year
                self.max_year = max_date.year
                self.initial_year = max_date.year
                self.initial_month = max_date.month

                elapsed = time.time() - start_time
                print(f"데이터 로드 완료!")
                print(f"    날짜 범위: {min_date.strftime('%Y-%m-%d')} ~ {max_date.strftime('%Y-%m-%d')}")
                print(f"    소요 시간: {elapsed:.2f}초")

        except Exception as e:
            print(f"데이터 로드 중 오류 발생: {e}")
            import traceback
            traceback.print_exc()

    def get_available_dates(self) -> list[str]:
        """사용 가능한 날짜 목록을 반환합니다."""
        if self.df.empty:
            return []
        return self.df['날짜'].dt.strftime('%Y-%m-%d').unique().tolist()

    def _to_records(self, data: pd.DataFrame) -> list[dict]:
        """DataFrame을 dict 리스트로 변환"""
        if len(data) == 0:
            return []
        data = data.copy()
        if '날짜' in data.columns:
            data['날짜'] = data['날짜'].dt.strftime('%Y-%m-%d')
        data = data.fillna(0).replace([float('inf'), float('-inf')], 0)
        return data.to_dict('records')

    def _get_sorted_dates(self) -> list:
        """정렬된 영업일 목록 반환"""
        if self.df.empty:
            return []
        dates = pd.to_datetime(self.df['날짜'].unique())
        return sorted(dates)

    # --- 한국주식 전용 메서드 ---
    def get_kr_day_data(self, date_str: str) -> dict:
        """한국주식: 특정 날짜의 데이터를 반환합니다."""
        date = pd.to_datetime(date_str)
        day_data = self.df[self.df['날짜'] == date].copy()

        if len(day_data) == 0:
            return {'trading_value': [], 'change_rate': []}

        # 거래대금 순 (상승률 3% 이상) - 상위 300개
        trading_value = (
            day_data[day_data['전일대비변동률(%)'] >= 3.0]
            .sort_values('거래대금', ascending=False)
            .head(300)
        )

        # 상승률 순 - 상위 300개
        change_rate = (
            day_data
            .sort_values('전일대비변동률(%)', ascending=False)
            .head(300)
        )

        return {
            'trading_value': self._to_records(trading_value),
            'change_rate': self._to_records(change_rate),
        }

    # --- 미국주식 전용 메서드 ---
    def get_us_day_data(self, date_str: str) -> dict:
        """미국주식: 특정 날짜의 가격대별 데이터를 반환합니다."""
        date = pd.to_datetime(date_str)
        day_data = self.df[self.df['날짜'] == date].copy()

        if len(day_data) == 0:
            return self._us_empty_result()

        # 가격대별 필터링
        high_price = day_data[day_data['종가'] >= 10]
        mid_price = day_data[(day_data['종가'] >= 5) & (day_data['종가'] < 10)]
        low_price = day_data[day_data['종가'] < 5]

        return {
            'high_price_volume': self._filter_by_volume(high_price),
            'high_price_rate': self._filter_by_rate(high_price),
            'mid_price_volume': self._filter_by_volume(mid_price),
            'mid_price_rate': self._filter_by_rate(mid_price),
            'low_price_volume': self._filter_by_volume(low_price),
            'low_price_rate': self._filter_by_rate(low_price),
        }

    def _filter_by_volume(self, data: pd.DataFrame, min_rate: float = 3.0, limit: int = 300) -> list[dict]:
        """거래대금 기준 TOP 필터링 (상승률 조건 포함)"""
        filtered = data[data['전일대비변동률(%)'] >= min_rate]
        result = filtered.sort_values('거래대금', ascending=False).head(limit)
        return self._to_records(result)

    def _filter_by_rate(self, data: pd.DataFrame, limit: int = 300) -> list[dict]:
        """상승률 기준 TOP 필터링"""
        result = data.sort_values('전일대비변동률(%)', ascending=False).head(limit)
        return self._to_records(result)

    def _us_empty_result(self) -> dict:
        return {
            'high_price_volume': [],
            'high_price_rate': [],
            'mid_price_volume': [],
            'mid_price_rate': [],
            'low_price_volume': [],
            'low_price_rate': [],
        }

    def _get_us_price_filtered_data(self, day_data: pd.DataFrame, category: str) -> pd.DataFrame:
        """미국주식: 카테고리에 따라 가격대 필터링된 데이터 반환"""
        if category.startswith('high_price'):
            data = day_data[day_data['종가'] >= 10]
        elif category.startswith('mid_price'):
            data = day_data[(day_data['종가'] >= 5) & (day_data['종가'] < 10)]
        else:  # low_price
            data = day_data[day_data['종가'] < 5]
        return data

    # --- 공통 메서드 ---
    def get_stock_history(self, stock_code: str, days: int = 90, end_date: str = None) -> dict:
        """특정 종목의 과거 차트 데이터 반환 (종가 기반)"""
        if self.df.empty:
            return {'line': [], 'candle': [], 'volume': [], 'change': {}, 'ma20': [], 'ma240': [], 'end_date': end_date}

        stock_data_full = self.df[self.df[self.code_col] == stock_code].copy()
        if len(stock_data_full) == 0:
            return {'line': [], 'candle': [], 'volume': [], 'change': {}, 'ma20': [], 'ma240': [], 'end_date': end_date}

        # 날짜 기준 정렬 (오래된 것부터)
        stock_data_full = stock_data_full.sort_values('날짜')

        # 이동평균선 계산 (전체 데이터 기준)
        stock_data_full['MA20'] = stock_data_full['종가'].rolling(window=20, min_periods=1).mean()
        stock_data_full['MA240'] = stock_data_full['종가'].rolling(window=240, min_periods=1).mean()

        # 표시할 범위 결정 (end_date 기준으로 days만큼 이전부터 최신 데이터까지)
        if end_date:
            end_dt = pd.to_datetime(end_date)
            data_before_end = stock_data_full[stock_data_full['날짜'] <= end_dt]
            if len(data_before_end) > days:
                start_idx = len(data_before_end) - days
                start_date = data_before_end.iloc[start_idx]['날짜']
            else:
                start_date = stock_data_full['날짜'].min()
            # end_date 이후 데이터도 포함 (차트에서 스크롤로 볼 수 있도록)
            stock_data = stock_data_full[stock_data_full['날짜'] >= start_date]
        else:
            stock_data = stock_data_full.tail(days)

        line_data = []
        candle_data = []
        volume_data = []
        ma20_data = []
        ma240_data = []
        change_data = {}
        prev_close = None

        # 소수점 자릿수 (미국주식은 2자리, 한국주식은 0자리)
        decimal_places = 2 if self.market == 'us' else 0

        # OHLC 컬럼 존재 여부 확인
        has_ohlc = all(col in stock_data.columns for col in ['시가', '고가', '저가'])

        for _, row in stock_data.iterrows():
            time_str = row['날짜'].strftime('%Y-%m-%d')
            close_price = float(row['종가'])

            # 거래정지일 체크: 시가가 0인 경우
            is_suspended = has_ohlc and float(row['시가']) == 0

            # 전일대비 변동률 계산
            if prev_close is not None and prev_close != 0:
                change_pct = ((close_price - prev_close) / prev_close) * 100
            else:
                change_pct = 0
            change_data[time_str] = round(change_pct, 2)

            # 라인 차트용
            line_data.append({
                'time': time_str,
                'value': close_price
            })

            # 거래정지일이 아닌 경우에만 캔들 그리기
            if not is_suspended:
                # 캔들스틱 차트용 (OHLC 있으면 사용, 없으면 종가로 대체)
                if has_ohlc:
                    open_price = float(row['시가'])
                    high_price = float(row['고가'])
                    low_price = float(row['저가'])
                else:
                    # 종가만 있는 경우: 전일 종가를 시가로, 종가를 고가/저가로 사용
                    open_price = prev_close if prev_close else close_price
                    if close_price >= open_price:
                        high_price = close_price
                        low_price = open_price
                    else:
                        high_price = open_price
                        low_price = close_price

                candle_data.append({
                    'time': time_str,
                    'open': open_price,
                    'high': high_price,
                    'low': low_price,
                    'close': close_price
                })

            # 거래대금 (거래정지일은 회색, 상승/하락에 따라 색상 구분)
            if is_suspended:
                volume_color = '#6B728080'  # 회색 (거래정지)
            else:
                volume_color = '#EF535080' if close_price >= (prev_close or close_price) else '#2196F380'

            volume_data.append({
                'time': time_str,
                'value': float(row['거래대금']),
                'color': volume_color
            })

            # 20일 이동평균선
            if pd.notna(row['MA20']):
                ma20_data.append({
                    'time': time_str,
                    'value': round(float(row['MA20']), decimal_places)
                })
            # 240일 이동평균선
            if pd.notna(row['MA240']):
                ma240_data.append({
                    'time': time_str,
                    'value': round(float(row['MA240']), decimal_places)
                })

            prev_close = close_price

        return {
            'line': line_data,
            'candle': candle_data,
            'volume': volume_data,
            'change': change_data,
            'ma20': ma20_data,
            'ma240': ma240_data,
            'end_date': end_date
        }

    def _get_top300_stocks(self, date, category: str) -> set:
        """특정 날짜의 카테고리별 상위 300개 종목코드 반환"""
        day_data = self.df[self.df['날짜'] == date].copy()
        if len(day_data) == 0:
            return set()

        # 미국주식 가격대 필터링
        if self.market == 'us':
            day_data = self._get_us_price_filtered_data(day_data, category)

        if category == 'trading_value' or category.endswith('_volume'):
            # 거래대금 순 (상승률 3% 이상)
            filtered = day_data[day_data['전일대비변동률(%)'] >= 3.0]
            top_300 = filtered.nlargest(300, '거래대금')
        else:
            # 상승률 순
            top_300 = day_data.nlargest(300, '전일대비변동률(%)')

        return set(top_300[self.code_col].tolist())

    def get_frequent_stocks(self, base_date: str, weeks: int, category: str) -> list[dict]:
        """기간별 빈출 종목 상위 100개 반환"""
        if self.df.empty:
            return []

        base = pd.to_datetime(base_date)
        business_days = weeks * 5

        available_dates = self._get_sorted_dates()
        past_dates = [d for d in available_dates if d <= base][-business_days:]

        if len(past_dates) == 0:
            return []

        stock_counts = {}
        stock_info = {}
        latest_date = past_dates[-1] if past_dates else None

        for date in past_dates:
            day_data = self.df[self.df['날짜'] == date].copy()
            if len(day_data) == 0:
                continue

            # 미국주식 가격대 필터링
            if self.market == 'us':
                day_data = self._get_us_price_filtered_data(day_data, category)

            if category == 'trading_value' or category.endswith('_volume'):
                filtered = day_data[day_data['전일대비변동률(%)'] >= 3.0]
                top_300 = filtered.nlargest(300, '거래대금')
            else:
                top_300 = day_data.nlargest(300, '전일대비변동률(%)')

            for _, row in top_300.iterrows():
                code = row[self.code_col]
                if code not in stock_counts:
                    stock_counts[code] = 0
                    stock_info[code] = {self.code_col: code, self.name_col: row[self.name_col]}
                stock_counts[code] += 1

        # 최근 날짜의 거래대금을 별도로 조회 (상위 300과 무관하게 모든 종목)
        latest_trading_value = {}
        if latest_date:
            latest_day_data = self.df[self.df['날짜'] == latest_date]
            for code in stock_counts.keys():
                stock_row = latest_day_data[latest_day_data[self.code_col] == code]
                if len(stock_row) > 0:
                    latest_trading_value[code] = stock_row.iloc[0]['거래대금']

        sorted_stocks = sorted(
            stock_counts.items(),
            key=lambda x: (x[1], latest_trading_value.get(x[0], 0)),
            reverse=True
        )[:100]

        result = []
        for rank, (code, count) in enumerate(sorted_stocks, 1):
            info = stock_info[code]
            item = {
                '순위': rank,
                self.code_col: info[self.code_col],
                '종목명': info[self.name_col],
                '등장횟수': count,
                '기간영업일수': len(past_dates),
                '최근거래대금': int(latest_trading_value.get(code, 0)),
            }
            result.append(item)
        return result

    def get_pullback_stocks(self, base_date: str, days_ago: int, category: str) -> list[dict]:
        """n일 전 상승 후 오늘 하락 마감한 종목 반환"""
        if self.df.empty:
            return []

        available_dates = self._get_sorted_dates()
        base = pd.to_datetime(base_date)

        try:
            base_idx = available_dates.index(base)
        except ValueError:
            return []

        past_idx = base_idx - days_ago
        if past_idx < 0:
            return []

        past_date = available_dates[past_idx]

        # n일 전 상위 300개 종목
        past_top300 = self._get_top300_stocks(past_date, category)
        if not past_top300:
            return []

        # 오늘 데이터에서 해당 종목들 중 하락한 것 필터링
        today_data = self.df[self.df['날짜'] == base].copy()
        if len(today_data) == 0:
            return []

        # 상위 300개에 있었던 종목 중 오늘 하락한 종목
        pullback = today_data[
            (today_data[self.code_col].isin(past_top300)) &
            (today_data['전일대비변동률(%)'] < 0)
        ].copy()

        # 거래대금 높은 순으로 정렬
        pullback = pullback.sort_values('거래대금', ascending=False)

        result = []
        for rank, (_, row) in enumerate(pullback.iterrows(), 1):
            price_value = int(row['종가']) if self.market == 'kr' else round(row['종가'], 2)
            item = {
                '순위': rank,
                self.code_col: row[self.code_col],
                '종목명': row[self.name_col],
                '전일대비변동률': round(row['전일대비변동률(%)'], 2),
                '종가': price_value,
                '거래대금': int(row['거래대금']),
                '기준일': past_date.strftime('%Y-%m-%d'),
            }
            result.append(item)
        return result

    def get_consecutive_rise_stocks(self, base_date: str, consecutive_days: int, category: str) -> list[dict]:
        """n일 연속 상승한 종목 반환"""
        if self.df.empty:
            return []

        available_dates = self._get_sorted_dates()
        base = pd.to_datetime(base_date)

        try:
            base_idx = available_dates.index(base)
        except ValueError:
            return []

        if base_idx < consecutive_days - 1:
            return []

        check_dates = [available_dates[base_idx - i] for i in range(consecutive_days)]
        check_dates.reverse()

        # 첫 번째 날 상위 300개 종목 (시작점)
        first_top300 = self._get_top300_stocks(check_dates[0], category)
        if not first_top300:
            return []

        # 각 날짜별로 상승한 종목 추적
        candidates = first_top300.copy()

        for date in check_dates:
            day_data = self.df[self.df['날짜'] == date].copy()
            if len(day_data) == 0:
                return []

            rising = day_data[day_data['전일대비변동률(%)'] > 0]
            rising_codes = set(rising[self.code_col].tolist())
            candidates = candidates & rising_codes

        if not candidates:
            return []

        # 오늘 데이터에서 결과 추출
        today_data = self.df[self.df['날짜'] == base].copy()
        result_data = today_data[today_data[self.code_col].isin(candidates)].copy()
        result_data = result_data.sort_values('거래대금', ascending=False)

        result = []
        for rank, (_, row) in enumerate(result_data.iterrows(), 1):
            price_value = int(row['종가']) if self.market == 'kr' else round(row['종가'], 2)
            item = {
                '순위': rank,
                self.code_col: row[self.code_col],
                '종목명': row[self.name_col],
                '전일대비변동률': round(row['전일대비변동률(%)'], 2),
                '종가': price_value,
                '거래대금': int(row['거래대금']),
                '연속일수': consecutive_days,
            }
            result.append(item)
        return result

    def search_stocks(self, query: str, limit: int = 50) -> list[dict]:
        """종목 검색 (대소문자 무관, 부분 매칭 지원, 관련도순 정렬)"""
        if self.df.empty or not query:
            return []

        query_upper = query.upper().strip()

        # 모든 고유 종목 가져오기
        unique_stocks = self.df[[self.code_col, self.name_col]].drop_duplicates()

        # 검색 결과를 우선순위별로 분류
        exact_code = []      # 코드 정확히 일치
        starts_code = []     # 코드가 검색어로 시작
        starts_name = []     # 이름이 검색어로 시작
        contains_code = []   # 코드에 검색어 포함
        contains_name = []   # 이름에 검색어 포함

        for _, row in unique_stocks.iterrows():
            code = str(row[self.code_col]).upper()
            name = str(row[self.name_col]).upper()
            stock = {'code': row[self.code_col], 'name': row[self.name_col]}

            if code == query_upper:
                exact_code.append(stock)
            elif code.startswith(query_upper):
                starts_code.append(stock)
            elif name.startswith(query_upper):
                starts_name.append(stock)
            elif query_upper in code:
                contains_code.append(stock)
            elif query_upper in name:
                contains_name.append(stock)

        # 우선순위 순서로 결과 합치기
        result = exact_code + starts_code + starts_name + contains_code + contains_name

        return result[:limit]

    def get_gap_analysis(
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
        ticker_filter: str = None
    ) -> list[dict]:
        """
        갭 상승 조건에 맞는 종목 필터링 (3단계 필터링)

        1단계 - 기준:
        base_price: 기준 가격 (prev_close, open, close)
        compare_price: 비교 가격 (open, close, next_open, next_close)

        2단계 - 추가 기준:
        extra_base: 추가 기준 기준 가격 (open, close)
        extra_compare: 추가 기준 비교 가격 (close, next_open, next_close)
        extra_direction: 추가 기준 방향 (up, down)

        3단계 - 세부 기준:
        detail_base: 세부 기준 기준 가격 (open, close)
        detail_compare: 세부 기준 비교 가격 (next_open, next_close)
        detail_direction: 세부 기준 방향 (up, down)

        ticker_filter: 종목 필터 (티커/종목명)
        """
        if self.df.empty:
            return []

        # 날짜 범위 필터링
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)

        # 종목별로 정렬된 데이터 준비
        df_sorted = self.df.sort_values([self.code_col, '날짜']).copy()

        # 이전일/익일 데이터 계산을 위해 shift 사용
        df_sorted['prev_close'] = df_sorted.groupby(self.code_col)['종가'].shift(1)
        df_sorted['next_open'] = df_sorted.groupby(self.code_col)['시가'].shift(-1)
        df_sorted['next_close'] = df_sorted.groupby(self.code_col)['종가'].shift(-1)

        # MA240 계산
        df_sorted['ma240'] = df_sorted.groupby(self.code_col)['종가'].transform(
            lambda x: x.rolling(window=240, min_periods=240).mean()
        )

        # 날짜 범위 필터링
        df_filtered = df_sorted[
            (df_sorted['날짜'] >= start_dt) &
            (df_sorted['날짜'] <= end_dt)
        ].copy()

        if len(df_filtered) == 0:
            return []

        # 종목 필터링 (티커/종목명)
        if ticker_filter:
            ticker_filter_upper = ticker_filter.upper().strip()
            mask = (
                df_filtered[self.code_col].str.upper().str.contains(ticker_filter_upper, na=False) |
                df_filtered[self.name_col].str.upper().str.contains(ticker_filter_upper, na=False)
            )
            df_filtered = df_filtered[mask]

            if len(df_filtered) == 0:
                return []

        # 기준 가격 컬럼 매핑
        base_col_map = {
            'prev_close': 'prev_close',
            'open': '시가',
            'close': '종가'
        }

        # 비교 가격 컬럼 매핑
        compare_col_map = {
            'open': '시가',
            'close': '종가',
            'next_open': 'next_open',
            'next_close': 'next_close'
        }

        base_col = base_col_map.get(base_price, 'prev_close')
        compare_col = compare_col_map.get(compare_price, '시가')

        # 1단계: 기준 상승률 계산
        df_filtered['gap_rate'] = (
            (df_filtered[compare_col] - df_filtered[base_col]) /
            df_filtered[base_col] * 100
        )

        # NaN 제거 (이전일/익일 데이터가 없는 경우)
        df_filtered = df_filtered.dropna(subset=['gap_rate'])

        # 상승률 범위 필터링
        df_result = df_filtered[
            (df_filtered['gap_rate'] >= min_rate) &
            (df_filtered['gap_rate'] <= max_rate)
        ].copy()

        if len(df_result) == 0:
            return []

        # 2단계: 추가 기준 필터링
        if extra_base and extra_compare and extra_direction:
            extra_base_col = base_col_map.get(extra_base)
            extra_compare_col = compare_col_map.get(extra_compare)
            if extra_base_col and extra_compare_col:
                df_result['extra_rate'] = (
                    (df_result[extra_compare_col] - df_result[extra_base_col]) /
                    df_result[extra_base_col] * 100
                )
                df_result = df_result.dropna(subset=['extra_rate'])

                if extra_direction == 'up':
                    df_result = df_result[df_result['extra_rate'] > 0]
                elif extra_direction == 'down':
                    df_result = df_result[df_result['extra_rate'] < 0]

        if len(df_result) == 0:
            return []

        # 3단계: 세부 기준 필터링
        if detail_base and detail_compare and detail_direction:
            detail_base_col = base_col_map.get(detail_base)
            detail_compare_col = compare_col_map.get(detail_compare)
            if detail_base_col and detail_compare_col:
                df_result['detail_rate'] = (
                    (df_result[detail_compare_col] - df_result[detail_base_col]) /
                    df_result[detail_base_col] * 100
                )
                df_result = df_result.dropna(subset=['detail_rate'])

                if detail_direction == 'up':
                    df_result = df_result[df_result['detail_rate'] > 0]
                elif detail_direction == 'down':
                    df_result = df_result[df_result['detail_rate'] < 0]

        if len(df_result) == 0:
            return []

        # 정렬: 날짜 오름차순, 같은 날짜는 거래대금 내림차순
        df_result = df_result.sort_values(
            ['날짜', '거래대금'],
            ascending=[True, False]
        )

        # 결과 변환
        result = []
        for _, row in df_result.iterrows():
            ma240_value = row.get('ma240')
            # MA240 대비 위치: 'above' (정배열), 'below' (역배열), None (데이터 부족)
            ma240_position = None
            if pd.notna(ma240_value) and ma240_value > 0:
                ma240_position = 'above' if row['종가'] >= ma240_value else 'below'

            item = {
                '날짜': row['날짜'].strftime('%Y-%m-%d'),
                '티커': row[self.code_col],
                '종목명': row[self.name_col],
                '종가': round(row['종가'], 2),
                '등락률': round(row['gap_rate'], 2),
                '거래대금': int(row['거래대금']),
                'ma240': round(ma240_value, 2) if pd.notna(ma240_value) else None,
                'ma240_position': ma240_position,
            }
            result.append(item)

        return result
