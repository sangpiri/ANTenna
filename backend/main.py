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
import asyncpg
import redis.asyncio as aioredis

from services.data_manager import StockDataManager
from services.user_manager import UserManager
from middleware.auth_middleware import AuthMiddleware
from routers import kr_stock, us_stock, user, auth, admin, backtest, market_indices
from config import DATABASE_URL, ALLOWED_ORIGINS, REDIS_URL

# --- 경로 설정 ---
BASE_DIR = Path(__file__).resolve().parent  # backend/ 폴더
USER_DATA_DIR = BASE_DIR / "user_data"
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

# --- 사용자 매니저 인스턴스 ---
user_manager = UserManager(str(USER_DATA_DIR))


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 실행되는 컨텍스트"""
    print("=" * 50)
    print("Stock 통합 API 서버 시작")
    print("=" * 50)

    # DB 커넥션 풀 생성
    app.state.db_pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=5,
        max_size=20
    )
    print(f"DB 연결 완료: {DATABASE_URL.split('@')[1]}")  # 비밀번호 제외 출력

    # Redis 연결
    app.state.redis = aioredis.from_url(REDIS_URL, decode_responses=True)
    try:
        await app.state.redis.ping()
        print(f"Redis 연결 완료")
    except Exception as e:
        print(f"Redis 연결 실패 (캐싱 비활성화): {e}")
        app.state.redis = None

    # 데이터 매니저 초기화 (DB 풀 + Redis 주입)
    app.state.kr_manager = StockDataManager('kr', app.state.db_pool, app.state.redis)
    app.state.us_manager = StockDataManager('us', app.state.db_pool, app.state.redis)

    # 라우터에 매니저 주입
    kr_stock.set_data_manager(app.state.kr_manager)
    us_stock.set_data_manager(app.state.us_manager)
    user.set_user_manager(user_manager)
    backtest.set_data_managers(app.state.kr_manager, app.state.us_manager)
    market_indices.set_db_pool(app.state.db_pool)

    print(f"  사용자 데이터: {USER_DATA_DIR}")
    print(f"  프론트엔드: {FRONTEND_DIST}")
    print("\n" + "=" * 50)
    print("서버 준비 완료! http://localhost:7002")
    if FRONTEND_DIST.exists():
        print("프론트엔드 빌드 파일 서빙 중")
    else:
        print("프론트엔드 빌드 파일 없음 (npm run build 실행 필요)")
    print("=" * 50 + "\n")

    yield

    # 서버 종료 시 풀 정리
    if app.state.redis:
        await app.state.redis.close()
    await app.state.db_pool.close()
    print("DB/Redis 연결 종료")


# --- FastAPI 앱 생성 ---
app = FastAPI(
    title="Stock API",
    description="한국주식 + 미국주식 통합 API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS 설정 — 허용된 도메인만 API 접근 가능
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# 인증 미들웨어 등록 (CORS 미들웨어 다음에)
app.add_middleware(AuthMiddleware)

# API 라우터 등록
app.include_router(kr_stock.router, prefix="/api/kr",    tags=["한국주식"])
app.include_router(us_stock.router, prefix="/api/us",    tags=["미국주식"])
app.include_router(user.router,     prefix="/api/user",  tags=["사용자"])
app.include_router(auth.router,     prefix="/api/auth",  tags=["인증"])
app.include_router(admin.router,    prefix="/api/admin",    tags=["관리자"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["백테스팅"])
app.include_router(market_indices.router, prefix="/api/indices", tags=["시장지표"])


@app.get("/api/health")
async def health_check(request: Request):
    """헬스 체크"""
    return {
        "status": "healthy",
        "db_connected": request.app.state.db_pool is not None,
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
