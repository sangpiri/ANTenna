"""
Google OAuth + JWT 인증 서비스
"""
import httpx
from jose import jwt
from fastapi import HTTPException
from datetime import datetime, timedelta
from config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRE_HOURS


async def exchange_google_code(code: str, redirect_uri: str) -> dict:
    """Google authorization code → access_token + 사용자 정보"""
    async with httpx.AsyncClient() as client:
        # 1) code → token 교환
        token_resp = await client.post(
            'https://oauth2.googleapis.com/token',
            data={
                'code': code,
                'client_id': GOOGLE_CLIENT_ID,
                'client_secret': GOOGLE_CLIENT_SECRET,
                'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code',
            }
        )
        token_data = token_resp.json()
        access_token = token_data['access_token']

        # 2) access_token → 사용자 정보 조회
        user_resp = await client.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f'Bearer {access_token}'}
        )
        return user_resp.json()


async def get_or_create_user(google_user: dict, db_pool) -> dict:
    """DB에서 사용자 조회 또는 생성 (첫 가입자 = admin)"""
    google_id = google_user['id']
    email = google_user['email']
    name = google_user.get('name', '')
    picture = google_user.get('picture', '')

    # 기존 사용자 확인
    user = await db_pool.fetchrow(
        "SELECT * FROM users WHERE google_id = $1", google_id
    )

    if user:
        await db_pool.execute(
            "UPDATE users SET last_login_at = NOW() WHERE id = $1",
            user['id']
        )
        return dict(user)

    # 신규 사용자: ADMIN_EMAIL과 일치하면 admin, 아니면 user
    from config import ADMIN_EMAIL
    role = 'admin' if (ADMIN_EMAIL and email == ADMIN_EMAIL) else 'user'

    user = await db_pool.fetchrow("""
        INSERT INTO users (google_id, email, name, picture_url, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    """, google_id, email, name, picture, role)

    return dict(user)


def create_jwt_token(user_id: int, role: str) -> str:
    """JWT 토큰 생성"""
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> dict:
    """JWT 토큰 검증 → payload 반환"""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


def require_role(request, required_role: str):
    """요청자의 role이 required_role 이상인지 확인"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(401, "로그인이 필요합니다")

    role_hierarchy = {'user': 1, 'premium': 2, 'admin': 3}
    user_level = role_hierarchy.get(user.get('role', 'user'), 0)
    required_level = role_hierarchy.get(required_role, 0)

    if user_level < required_level:
        raise HTTPException(403, f"{required_role} 이상 권한이 필요합니다")