"""
JWT 인증 미들웨어
- Authorization 헤더에서 JWT 토큰을 추출하여 검증
- 검증 성공 시 request.state.user에 사용자 정보 설정
- 인증이 필요 없는 API(주식 조회 등)에서도 에러 없이 통과 (선택적 인증)
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from services.auth_service import verify_jwt_token


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user = None  # 기본값: 비로그인

        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
            try:
                payload = verify_jwt_token(token)
                # DB에서 최신 사용자 정보 조회 (role 변경 즉시 반영)
                db_pool = request.app.state.db_pool
                user = await db_pool.fetchrow(
                    "SELECT id, email, name, picture_url, role FROM users WHERE id = $1",
                    payload['user_id']
                )
                if user:
                    request.state.user = dict(user)
            except Exception:
                # 토큰이 유효하지 않아도 에러를 발생시키지 않음 (선택적 인증)
                # 인증이 필요한 API는 require_role()에서 검증
                pass

        response = await call_next(request)
        return response