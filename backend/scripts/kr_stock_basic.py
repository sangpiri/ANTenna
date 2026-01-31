"""
한국 주식 데이터 초기 수집 스크립트 (전략 3: 하이브리드 최적화)
KOSPI, KOSDAQ 전체 종목의 과거 데이터를 수집합니다.
- 워커 수 증가 (40개)
- Connection Pool 재사용
- 재시도 로직
- 짧은 타임아웃
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

# --- 설정 ---
START_DATE = '2022-01-01'
OUTPUT_FILE = '../data/kr_stock_data.csv'
MAX_WORKERS = 40  # 워커 수 증가
TIMEOUT = 15  # 타임아웃 단축
MAX_RETRIES = 3  # 최대 재시도

# 전역 세션 (Connection Pool 재사용)
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
    return _session


def get_all_stock_list() -> tuple[pd.DataFrame, dict]:
    """KOSPI, KOSDAQ 전체 종목 리스트를 수집합니다."""
    print("종목 리스트 수집 중...")

    kospi_list = fdr.StockListing('KOSPI')
    kosdaq_list = fdr.StockListing('KOSDAQ')

    all_stocks = pd.concat([kospi_list, kosdaq_list], ignore_index=True)
    all_stocks = all_stocks.drop_duplicates(subset=['Code'], keep='first')

    stock_info_map = all_stocks.set_index('Code')[['Name', 'Market']].to_dict('index')

    print(f"\n{'='*50}")
    print("종목 리스트 수집 완료")
    print(f"{'='*50}")
    print(f"전체 종목 수: {len(all_stocks):,}")
    print(f"- KOSPI: {len(kospi_list):,}")
    print(f"- KOSDAQ: {len(kosdaq_list):,}")

    return all_stocks, stock_info_map


def fetch_stock_data_fast(code: str, name: str, market: str,
                          start_date: str, end_date: str) -> pd.DataFrame | None:
    """네이버 금융 API로 빠르게 데이터를 가져옵니다."""
    session = get_session()

    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt = datetime.strptime(end_date, '%Y-%m-%d')

    url = "https://fchart.stock.naver.com/siseJson.naver"
    params = {
        'symbol': code,
        'requestType': '1',
        'startTime': start_dt.strftime('%Y%m%d'),
        'endTime': end_dt.strftime('%Y%m%d'),
        'timeframe': 'day'
    }

    for attempt in range(MAX_RETRIES):
        try:
            response = session.get(url, params=params, timeout=TIMEOUT)
            if response.status_code == 200:
                text = response.text.strip().replace("'", '"')

                import json
                data = json.loads(text)
                if not data or len(data) <= 1:
                    break

                headers = [h.strip() for h in data[0]]
                rows = data[1:]

                df = pd.DataFrame(rows, columns=headers)
                df['날짜'] = pd.to_datetime(df['날짜'].str.strip())

                for col in ['시가', '고가', '저가', '종가', '거래량']:
                    if col in df.columns:
                        df[col] = pd.to_numeric(df[col], errors='coerce')

                if df.empty or '종가' not in df.columns:
                    break

                df['Change_Rate'] = df['종가'].pct_change(fill_method=None) * 100
                df['Change_Rate'] = df['Change_Rate'].fillna(0)
                df['Trading_Value'] = df['종가'] * df['거래량']

                result = pd.DataFrame({
                    '날짜': df['날짜'],
                    '종목명': name,
                    '종목코드': code,
                    '시장': market,
                    '시가': df['시가'].values,
                    '고가': df['고가'].values,
                    '저가': df['저가'].values,
                    '종가': df['종가'].values,
                    '전일대비변동률(%)': df['Change_Rate'].values,
                    '거래량': df['거래량'].values,
                    '거래대금': df['Trading_Value'].values
                })

                return result

        except Exception:
            if attempt < MAX_RETRIES - 1:
                time.sleep(0.1 * (attempt + 1))

    # Fallback to FDR
    return fetch_stock_data_fdr(code, name, market, start_date, end_date)


def fetch_stock_data_fdr(code: str, name: str, market: str,
                         start_date: str, end_date: str) -> pd.DataFrame | None:
    """FinanceDataReader로 데이터를 가져옵니다 (Fallback)."""
    for attempt in range(MAX_RETRIES):
        try:
            df = fdr.DataReader(code, start_date, end_date)

            if df is None or len(df) == 0:
                return None

            df['Change_Rate'] = df['Close'].pct_change(fill_method=None) * 100
            df['Change_Rate'] = df['Change_Rate'].fillna(0)
            df['Trading_Value'] = df['Close'] * df['Volume']

            result = pd.DataFrame({
                '날짜': df.index,
                '종목명': name,
                '종목코드': code,
                '시장': market,
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
                time.sleep(0.1 * (attempt + 1))

    return None


def collect_data_parallel(stock_info_map: dict,
                          start_date: str, end_date: str) -> list[pd.DataFrame]:
    """멀티스레딩으로 여러 종목의 데이터를 병렬 수집합니다."""
    results = []
    success_count = 0
    skip_count = 0
    codes = list(stock_info_map.keys())
    total = len(codes)

    print(f"\n**하이브리드 최적화 ({MAX_WORKERS}개 워커)으로 데이터 수집 시작...**\n")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                fetch_stock_data_fast,
                code,
                stock_info_map[code]['Name'],
                stock_info_map[code]['Market'],
                start_date,
                end_date
            ): code
            for code in codes
        }

        for i, future in enumerate(as_completed(futures, timeout=3600)):
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
    df = df.sort_values(['날짜', '종목명'])
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
    print(f"수집 종목 수: {df['종목코드'].nunique():,}")
    print(f"수집 기간: {df['날짜'].min()} ~ {df['날짜'].max()}")

    print("\n시장별 종목 수:")
    for market in ['KOSPI', 'KOSDAQ']:
        count = df[df['시장'] == market]['종목코드'].nunique()
        print(f"- {market}: {count:,}")


def main():
    """메인 실행 함수"""
    end_date = datetime.now().strftime('%Y-%m-%d')

    print(f"데이터 수집 기간: {START_DATE} ~ {end_date}")
    print("(전략 3: 하이브리드 최적화 버전)")
    print(f"{'='*50}\n")

    # 종목 리스트 수집
    _, stock_info_map = get_all_stock_list()

    # 데이터 수집
    result_list = collect_data_parallel(stock_info_map, START_DATE, end_date)

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
