"""
미국 주식 데이터 업데이트 스크립트 (전략 3: 하이브리드 최적화)
기존 CSV 파일의 데이터를 최신 날짜까지 업데이트합니다.
"""

import FinanceDataReader as fdr
import pandas as pd
from datetime import datetime, timedelta
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from io import StringIO

# --- 설정 ---
FILE_NAME = '../data/us_stock_data.csv'
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


def load_existing_data(file_path: str) -> tuple[pd.DataFrame, str, list, dict]:
    """기존 CSV 데이터를 로드합니다."""
    existing_df = pd.read_csv(file_path, encoding='utf-8-sig')
    existing_df['날짜'] = pd.to_datetime(existing_df['날짜'])

    latest_date = existing_df['날짜'].max()
    start_date = (latest_date - timedelta(days=1)).strftime('%Y-%m-%d')

    symbols = existing_df['티커'].unique().tolist()
    stock_info_map = (
        existing_df[['티커', '종목명', '거래소']]
        .drop_duplicates(subset=['티커'])
        .set_index('티커')
        .to_dict('index')
    )

    print(f"\n{'='*50}")
    print(f"기존 데이터 로드 완료. 총 {len(existing_df):,} 행")
    print(f"가장 최근 날짜: {latest_date.strftime('%Y-%m-%d')}")
    print(f"업데이트 시작 날짜: {start_date}")
    print(f"업데이트 대상 종목 수: {len(symbols):,}")
    print(f"{'='*50}\n")

    return existing_df, start_date, symbols, stock_info_map


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

                df['거래대금'] = df['Close'] * df['Volume']

                result = pd.DataFrame({
                    '날짜': df['Date'],
                    '종목명': name,
                    '티커': symbol,
                    '거래소': exchange,
                    '시가': df['Open'].values,
                    '고가': df['High'].values,
                    '저가': df['Low'].values,
                    '종가': df['Close'].values,
                    '거래량': df['Volume'].values,
                    '거래대금': df['거래대금'].values
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

            df['거래대금'] = df['Close'] * df['Volume']

            result = pd.DataFrame({
                '날짜': pd.to_datetime(df.index),
                '종목명': name,
                '티커': symbol,
                '거래소': exchange,
                '시가': df['Open'].values,
                '고가': df['High'].values,
                '저가': df['Low'].values,
                '종가': df['Close'].values,
                '거래량': df['Volume'].values,
                '거래대금': df['거래대금'].values
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

    print(f"**하이브리드 최적화 ({MAX_WORKERS}개 워커)으로 업데이트 데이터 수집 시작...**\n")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                fetch_stock_data_fast,
                symbol,
                stock_info_map[symbol]['종목명'],
                stock_info_map[symbol]['거래소'],
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
    print(f"\n총 업데이트 데이터 수집 소요 시간: {elapsed:.2f} 초")

    return results


def merge_and_calculate(existing_df: pd.DataFrame,
                        new_data_list: list[pd.DataFrame]) -> pd.DataFrame:
    """기존 데이터와 새 데이터를 병합하고 변동률을 재계산합니다."""
    new_df = pd.concat(new_data_list, ignore_index=True)

    if '전일대비변동률(%)' in existing_df.columns:
        existing_df = existing_df.drop(columns=['전일대비변동률(%)'])

    combined = pd.concat([existing_df, new_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=['날짜', '티커'], keep='last')
    combined = combined.sort_values(['티커', '날짜'])

    print(f"\n{'='*50}")
    print("전일대비변동률 재계산 중...")
    print(f"{'='*50}")

    combined['전일대비변동률(%)'] = (
        combined.groupby('티커')['종가']
        .pct_change(fill_method=None) * 100
    ).fillna(0)

    final = combined[[
        '날짜', '종목명', '티커', '거래소',
        '시가', '고가', '저가', '종가', '전일대비변동률(%)', '거래량', '거래대금'
    ]].sort_values(['날짜', '티커'])

    print(f"\n{'='*50}")
    print("데이터 병합 완료!")
    print(f"{'='*50}")
    print(f"업데이트 전 행 수: {len(existing_df):,}")
    print(f"새로 수집한 행 수: {len(new_df):,}")
    print(f"업데이트 후 최종 행 수: {len(final):,}")
    print(f"순증가 행 수: {len(final) - len(existing_df):,}")

    return final


def save_and_verify(df: pd.DataFrame, file_path: str) -> None:
    """데이터를 저장하고 검증 샘플을 출력합니다."""
    df.to_csv(file_path, index=False, encoding='utf-8-sig')
    print(f"\n파일 저장 완료: {file_path}")

    print(f"\n{'='*50}")
    print("최종 데이터 샘플 (최신 10개 행)")
    print(f"{'='*50}")
    print(df.tail(10))

    if 'AAPL' in df['티커'].values:
        print(f"\n{'='*50}")
        print("변동률 검증 샘플 (AAPL 최근 5일)")
        print(f"{'='*50}")
        print(df[df['티커'] == 'AAPL'].tail(5))


def main():
    """메인 실행 함수"""
    print(f"데이터 업데이트 시작 시각: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("(전략 3: 하이브리드 최적화 버전)")

    end_date = datetime.now().strftime('%Y-%m-%d')
    print(f"최종 수집 대상 날짜: {end_date}")

    script_dir = Path(__file__).parent
    file_path = script_dir / FILE_NAME
    print(f"사용할 CSV 파일: {file_path}")

    try:
        existing_df, start_date, symbols, stock_info_map = load_existing_data(file_path)
    except FileNotFoundError:
        print(f"\n{FILE_NAME} 파일을 찾을 수 없습니다.")
        print("기존 파일이 없을 경우, us_stock_basic_3.py를 먼저 실행하세요.")
        return
    except Exception as e:
        print(f"\n기존 파일 로드 중 오류 발생: {e}")
        return

    new_data_list = collect_data_parallel(symbols, stock_info_map, start_date, end_date)

    if not new_data_list:
        print("\n수집된 새로운 데이터가 없습니다. 업데이트할 내용이 없습니다.")
        return

    final_df = merge_and_calculate(existing_df, new_data_list)
    save_and_verify(final_df, file_path)

    print(f"\n{'='*50}")
    print(f"수집 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}")


if __name__ == '__main__':
    main()
