"""
한국 주식 데이터 업데이트 스크립트 (전략 3: 하이브리드 최적화)
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

# --- 설정 ---
FILE_NAME = '../data/kr_stock_data.csv'
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
    return _session


def load_existing_data(file_path: str) -> tuple[pd.DataFrame, str, list, dict]:
    """기존 CSV 데이터를 로드합니다."""
    existing_df = pd.read_csv(file_path, encoding='utf-8-sig')
    existing_df['날짜'] = pd.to_datetime(existing_df['날짜'])

    latest_date = existing_df['날짜'].max()
    # 안전 마진: 1일 전부터 다시 가져와서 불완전한 데이터 보정
    start_date = (latest_date - timedelta(days=1)).strftime('%Y-%m-%d')

    codes = existing_df['종목코드'].unique().tolist()
    stock_info_map = (
        existing_df[['종목코드', '종목명', '시장']]
        .drop_duplicates(subset=['종목코드'])
        .set_index('종목코드')
        .to_dict('index')
    )

    print(f"\n{'='*50}")
    print(f"기존 데이터 로드 완료. 총 {len(existing_df):,} 행")
    print(f"가장 최근 날짜: {latest_date.strftime('%Y-%m-%d')}")
    print(f"업데이트 시작 날짜: {start_date}")
    print(f"업데이트 대상 종목 수: {len(codes):,}")
    print(f"{'='*50}\n")

    return existing_df, start_date, codes, stock_info_map


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

                df['거래대금'] = df['종가'] * df['거래량']

                result = pd.DataFrame({
                    '날짜': df['날짜'],
                    '종목명': name,
                    '종목코드': code,
                    '시장': market,
                    '시가': df['시가'].values,
                    '고가': df['고가'].values,
                    '저가': df['저가'].values,
                    '종가': df['종가'].values,
                    '거래량': df['거래량'].values,
                    '거래대금': df['거래대금'].values
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

            df['거래대금'] = df['Close'] * df['Volume']

            result = pd.DataFrame({
                '날짜': pd.to_datetime(df.index),
                '종목명': name,
                '종목코드': code,
                '시장': market,
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
                time.sleep(0.1 * (attempt + 1))

    return None


def collect_data_parallel(codes: list, stock_info_map: dict,
                          start_date: str, end_date: str) -> list[pd.DataFrame]:
    """멀티스레딩으로 여러 종목의 데이터를 병렬 수집합니다."""
    results = []
    success_count = 0
    skip_count = 0
    total = len(codes)

    print(f"**하이브리드 최적화 ({MAX_WORKERS}개 워커)으로 업데이트 데이터 수집 시작...**\n")
    start_time = time.time()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(
                fetch_stock_data_fast,
                code,
                stock_info_map[code]['종목명'],
                stock_info_map[code]['시장'],
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
    print(f"\n총 업데이트 데이터 수집 소요 시간: {elapsed:.2f} 초")

    return results


def merge_and_calculate(existing_df: pd.DataFrame,
                        new_data_list: list[pd.DataFrame]) -> pd.DataFrame:
    """기존 데이터와 새 데이터를 병합하고 변동률을 재계산합니다."""
    new_df = pd.concat(new_data_list, ignore_index=True)

    if '전일대비변동률(%)' in existing_df.columns:
        existing_df = existing_df.drop(columns=['전일대비변동률(%)'])

    combined = pd.concat([existing_df, new_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=['날짜', '종목코드'], keep='last')
    combined = combined.sort_values(['종목코드', '날짜'])

    print(f"\n{'='*50}")
    print("전일대비변동률 재계산 중...")
    print(f"{'='*50}")

    combined['전일대비변동률(%)'] = (
        combined.groupby('종목코드')['종가']
        .pct_change(fill_method=None) * 100
    ).fillna(0)

    final = combined[[
        '날짜', '종목명', '종목코드', '시장',
        '시가', '고가', '저가', '종가', '전일대비변동률(%)', '거래량', '거래대금'
    ]].sort_values(['날짜', '종목명'])

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

    if '005930' in df['종목코드'].values:
        print(f"\n{'='*50}")
        print("변동률 검증 샘플 (삼성전자 최근 5일)")
        print(f"{'='*50}")
        print(df[df['종목코드'] == '005930'].tail(5))


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
        existing_df, start_date, codes, stock_info_map = load_existing_data(file_path)
    except FileNotFoundError:
        print(f"\n{FILE_NAME} 파일을 찾을 수 없습니다.")
        print("기존 파일이 없을 경우, kr_stock_basic_3.py를 먼저 실행하세요.")
        return
    except Exception as e:
        print(f"\n기존 파일 로드 중 오류 발생: {e}")
        return

    new_data_list = collect_data_parallel(codes, stock_info_map, start_date, end_date)

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
