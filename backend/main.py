"""
Stock 통합 API 서버
한국주식 + 미국주식 + 사용자 데이터를 단일 포트(7002)에서 제공
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from pathlib import Path
import os

from services.data_manager import StockDataManager
from services.user_manager import UserManager
from routers import kr_stock, us_stock, user

# --- 경로 설정 ---
BASE_DIR = Path(__file__).resolve().parent  # backend/ 폴더
DATA_DIR = BASE_DIR / "data"  # backend/data/ 폴더
USER_DATA_DIR = BASE_DIR.parent / "user_data"
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

KR_DATA_FILE = DATA_DIR / "kr_stock_data.csv"
US_DATA_FILE = DATA_DIR / "us_stock_data.csv"

# --- 매니저 인스턴스 ---
kr_data_manager = StockDataManager(market='kr')
us_data_manager = StockDataManager(market='us')
user_manager = UserManager(str(USER_DATA_DIR))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 컨텍스트"""
    print("=" * 50)
    print("Stock 통합 API 서버 시작")
    print("=" * 50)

    # 데이터 로드
    print(f"\n[데이터 파일 경로]")
    print(f"  한국주식: {KR_DATA_FILE}")
    print(f"  미국주식: {US_DATA_FILE}")
    print(f"  사용자 데이터: {USER_DATA_DIR}")
    print(f"  프론트엔드: {FRONTEND_DIST}")
    print()

    kr_data_manager.load_data(str(KR_DATA_FILE))
    print()
    us_data_manager.load_data(str(US_DATA_FILE))

    # 라우터에 매니저 주입
    kr_stock.set_data_manager(kr_data_manager)
    us_stock.set_data_manager(us_data_manager)
    user.set_user_manager(user_manager)

    print("\n" + "=" * 50)
    print("서버 준비 완료! http://localhost:7002")
    if FRONTEND_DIST.exists():
        print("프론트엔드 빌드 파일 서빙 중")
    else:
        print("프론트엔드 빌드 파일 없음 (npm run build 실행 필요)")
    print("=" * 50 + "\n")

    yield

    print("서버 종료")


# --- FastAPI 앱 생성 ---
app = FastAPI(
    title="Stock API",
    description="한국주식 + 미국주식 통합 API",
    version="2.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
app.include_router(kr_stock.router, prefix="/api/kr", tags=["한국주식"])
app.include_router(us_stock.router, prefix="/api/us", tags=["미국주식"])
app.include_router(user.router, prefix="/api/user", tags=["사용자"])


@app.get("/api/health")
async def health_check():
    """헬스 체크"""
    return {
        "status": "healthy",
        "kr_data_loaded": not kr_data_manager.df.empty,
        "us_data_loaded": not us_data_manager.df.empty,
        "kr_data_rows": len(kr_data_manager.df),
        "us_data_rows": len(us_data_manager.df)
    }


# 프론트엔드 정적 파일 서빙 (빌드 후)
if FRONTEND_DIST.exists():
    # 정적 파일 (JS, CSS, 이미지 등)
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    # SPA 라우팅 - API가 아닌 모든 요청을 index.html로
    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """SPA 라우팅 - index.html 서빙"""
        # API 요청은 제외
        if full_path.startswith("api/"):
            return {"error": "Not found"}

        # 정적 파일 확인
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)

        # 나머지는 index.html (SPA 라우팅)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    async def root():
        """API 서버 상태 확인"""
        return {
            "status": "running",
            "message": "Stock API Server",
            "version": "2.0.0",
            "note": "프론트엔드를 사용하려면 frontend/ 폴더에서 npm run build를 실행하세요",
            "endpoints": {
                "한국주식": "/api/kr/",
                "미국주식": "/api/us/",
                "사용자": "/api/user/"
            }
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=7002,
        reload=True
    )
