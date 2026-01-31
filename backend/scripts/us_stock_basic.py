"""
미국 주식 데이터 초기 수집 스크립트 (전략 3: 하이브리드 최적화)
NASDAQ, NYSE, NYSE American 전체 종목의 과거 데이터를 수집합니다.
"""

import FinanceDataReader as fdr
import pandas as pd
from datetime import datetime
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from io import StringIO

# --- 설정 ---
START_DATE = '2022-01-01'
OUTPUT_FILE = '../data/us_stock_data.csv'
MAX_WORKERS = 40  # 워커 수 증가
TIMEOUT = 15  # 타임아웃 단축
MAX_RETRIES = 3  # 최대 재시도

# 전역 세션
_session = None


def get_session() -> requests.Session:
    """Connection Pool이 적용된 세션을 반환합니다."""
    global _session
    if _session is None:
        _session = requests.Session()
        retry_strategy = Retry(
            total=MAX_RETRIES,
            backoff_factor=0.1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=50,
            pool_maxsize=50
        )
        _session.mount("http://", adapter)
        _session.mount("https://", adapter)
        _session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    return _session


def get_all_stock_list() -> tuple[list, dict]:
    """NASDAQ, NYSE, NYSE American 전체 종목 리스트를 수집합니다."""
    print("종목 리스트 수집 중...")

    exchanges = [
        ('NASDAQ', 'NASDAQ'),
        ('NYSE', 'NYSE'),
        ('AMEX', 'NYSE American')
    ]

    dfs = []
    for code, name in exchanges:
        df = fdr.StockListing(code)
        df['Exchange'] = name
        dfs.append(df)

    all_stocks = pd.concat(dfs, ignore_index=True)
    all_stocks = all_stocks.drop_duplicates(subset=['Symbol'], keep='first')

    stock_info_map = all_stocks.set_index('Symbol')[['Name', 'Exchange']].to_dict('index')
    symbols = list(stock_info_map.keys())

    print(f"\n{'='*50}")
    print("종목 리스트 수집 완료")
    print(f"{'='*50}")
    print(f"전체 종목 수: {len(symbols):,}")

    return symbols, stock_info_map


def fetch_stock_data_fast(symbol: str, name: str, exchange: str,
                          start_date: str, end_date: str) -> pd.DataFrame | None:
    """Yahoo Finance API로 빠르게 데이터를 가져옵니다."""
    session = get_session()

    start_ts = int(datetime.strptime(start_date, '%Y-%m-%d').timestamp())
    end_ts = int(datetime.strptime(end_date, '%Y-%m-%d').timestamp())

    url = f"https://query1.finance.yahoo.com/v7/finance/download/{symbol}"
    params = {
        'period1': start_ts,
        'period2': end_ts,
        'interval': '1d',
        'events': 'history'
    }

    for attempt in range(MAX_RETRIES):
        try:
            response = session.get(url, params=params, timeout=TIMEOUT)
            if response.status_code == 200:
                text = response.text
                lines = text.strip().split('\n')

                if len(lines) <= 1:
                    break

                df = pd.read_csv(StringIO(text))

                if df.empty or 'Close' not in df.columns:
                    break

                df['Date'] = pd.to_datetime(df['Date'])
                df = df.dropna(subset=['Close'])

                if df.empty:
                    break

                df['Change_Rate'] = df['Close'].pct_change(fill_method=None) * 100
                df['Change_Rate'] = df['Change_Rate'].fillna(0)
                df['Trading_Value'] = df['Close'] * df['Volume']

                result = pd.DataFrame({
                    '날짜': df['Date'],
                    '종목명': name,
                    '티커': symbol,
                    '거래소': exchange,
                    '시가': df['Open'].values,
                    '고가': df['High'].values,
                    '저가': df['Low'].values,
                    '종가': df['Close'].values,
                    '전일대비변동률(%)': df['Change_Rate'].values,
                    '거래량': df['Volume'].values,
                    '거래대금': df['Trading_Value'].values
                })

                return result

        except Exception:
            if attempt < MAX_RETRIES - 1:
                time.sleep(0.2 * (attempt + 1))

    # Fallback to FDR
    return fetch_stock_data_fdr(symbol, name, exchange, start_date, end_date)


def fetch_stock_data_fdr(symbol: str, name: str, exchange: str,
                         start_date: str, end_date: str) -> pd.DataFrame | None:
    """FinanceDataReader로 데이터를 가져옵니다 (Fallback)."""
    for attempt in range(MAX_RETRIES):
        try:
            df = fdr.DataReader(symbol, start_date, end_date)

            if df is None or len(df) == 0:
                return None

            df['Change_Rate'] = df['Close'].pct_change(fill_method=None) * 100
            df['Change_Rate'] = df['Change_Rate'].fillna(0)
            df['Trading_Value'] = df['Close'] * df['Volume']

            result = pd.DataFrame({
                '날짜': df.index,
                '종목명': name,
                '티커': symbol,
                '거래소': exchange,
                '시가': df['Open'].values,
                '고가': df['High'].values,
                '저가': df['Low'].values,
                '종가': df['Close'].values,
                '전일대비변동률(%)': df['Change_Rate'].values,
                '거래량': df['Volume'].values,
                '거래대금': df['Trading_Value'].values
            })

            return result

        except Exception:
            if attempt < MAX_RETRIES - 1:
                time.sleep(0.2 * (attempt + 1))

    return None


def collect_data_parallel(symbols: list, stock_info_map: dict,
                          start_date: str, end_date: str) -> list[pd.DataFrame]:
    """멀티스레딩으로 여러 종목의 데이터를 병렬 수집합니다."""
    results = []
    success_count = 0
    skip_count = 0
    total = len(symbols)

    print(f"\n**하이브리드 최적화 ({MAX_WORKERS}개 워커)으로 데이터 수집 시작...**\n")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                fetch_stock_data_fast,
                symbol,
                stock_info_map[symbol]['Name'],
                stock_info_map[symbol]['Exchange'],
                start_date,
                end_date
            ): symbol
            for symbol in symbols
        }

        for i, future in enumerate(as_completed(futures, timeout=7200)):
            try:
                df = future.result(timeout=TIMEOUT + 5)
                if df is not None:
                    results.append(df)
                    success_count += 1
                else:
                    skip_count += 1
            except TimeoutError:
                skip_count += 1
            except Exception:
                skip_count += 1

            if (i + 1) % 100 == 0 or (i + 1) == total:
                elapsed = time.time() - start_time
                rate = (i + 1) / elapsed if elapsed > 0 else 0
                print(f"진행 중... {i + 1}/{total:,} | 성공: {success_count:,} | 스킵: {skip_count:,} | {rate:.1f}개/초")

    elapsed = time.time() - start_time
    print(f"\n총 소요 시간: {elapsed:.2f} 초 ({total/elapsed:.1f} 종목/초)")

    return results


def save_and_summarize(df: pd.DataFrame, file_path: str) -> None:
    """데이터를 저장하고 요약 정보를 출력합니다."""
    df = df.sort_values(['날짜', '티커'])
    df.to_csv(file_path, index=False, encoding='utf-8-sig')

    print(f"\n{'='*50}")
    print("데이터 수집 완료!")
    print(f"{'='*50}")
    print(f"총 데이터 행 수: {len(df):,}")
    print(f"파일 저장 완료: {file_path}")

    print(f"\n{'='*50}")
    print("데이터 샘플")
    print(f"{'='*50}")
    print(df.head(10))

    print(f"\n{'='*50}")
    print("데이터 요약")
    print(f"{'='*50}")
    print(f"수집 종목 수: {df['티커'].nunique():,}")
    print(f"수집 기간: {df['날짜'].min()} ~ {df['날짜'].max()}")

    print("\n거래소별 종목 수:")
    for exchange in ['NASDAQ', 'NYSE', 'NYSE American']:
        count = df[df['거래소'] == exchange]['티커'].nunique()
        print(f"- {exchange}: {count:,}")


def main():
    """메인 실행 함수"""
    end_date = datetime.now().strftime('%Y-%m-%d')

    print(f"데이터 수집 기간: {START_DATE} ~ {end_date}")
    print("(전략 3: 하이브리드 최적화 버전)")
    print(f"{'='*50}\n")

    # 종목 리스트 수집
    symbols, stock_info_map = get_all_stock_list()

    # 데이터 수집
    result_list = collect_data_parallel(symbols, stock_info_map, START_DATE, end_date)

    if not result_list:
        print("\n수집된 데이터가 없습니다.")
        return

    # 결과 합치기
    final_df = pd.concat(result_list, ignore_index=True)

    # 저장 및 요약
    script_dir = Path(__file__).parent
    file_path = script_dir / OUTPUT_FILE
    save_and_summarize(final_df, file_path)

    print(f"\n{'='*50}")
    print(f"수집 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}")


if __name__ == '__main__':
    main()
