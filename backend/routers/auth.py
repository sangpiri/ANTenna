from fastapi import APIRouter, Request, HTTPException
from services.auth_service import exchange_google_code, get_or_create_user, create_jwt_token

router = APIRouter()

@router.post("/google")
async def google_login(request: Request):
    """Google OAuth code → JWT 토큰 반환"""
    body = await request.json()
    code = body.get('code')
    redirect_uri = body.get('redirect_uri')

    if not code:
        raise HTTPException(400, "code is required")

    # Google에서 사용자 정보 받기
    google_user = await exchange_google_code(code, redirect_uri)

    # DB에 사용자 저장/조회
    db_pool = request.app.state.db_pool
    user = await get_or_create_user(google_user, db_pool)

    # JWT 토큰 생성
    token = create_jwt_token(user['id'], user['role'])

    return {
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'picture_url': user['picture_url'],
            'role': user['role'],
        }
    }

@router.get("/me")
async def get_current_user(request: Request):
    """현재 로그인된 사용자 정보"""
    user = request.state.user  # auth_middleware에서 설정
    if not user:
        raise HTTPException(401, "로그인이 필요합니다")
    return user
