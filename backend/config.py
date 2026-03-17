"""
환경변수 설정 (로컬 개발 / 서버 배포 공용)
"""
import os
from dotenv import load_dotenv

load_dotenv()  # .env 파일에서 환경변수 로딩

# 실행 환경: 'local' | 'production'
ENV = os.getenv('ENV', 'local')

# 데이터베이스
DATABASE_URL = os.getenv(
    'DATABASE_URL',
    'postgresql://antenna:localdev@localhost:5432/antenna'
)

# Google OAuth (Phase 3에서 설정)
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')

# JWT — 운영 환경에서는 반드시 환경변수로 설정해야 함
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_HOURS = 24 * 7  # 7일

if not JWT_SECRET_KEY:
    if ENV == 'production':
        raise ValueError(
            "JWT_SECRET_KEY 환경변수가 설정되지 않았습니다. "
            ".env 파일에 JWT_SECRET_KEY=<랜덤 문자열>을 추가하세요. "
            "생성 방법: openssl rand -hex 32"
        )
    # 로컬 개발용 기본값 (운영에서는 절대 사용 금지)
    JWT_SECRET_KEY = 'local-dev-only-do-not-use-in-production'

# Redis
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

# CORS 허용 도메인
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5200').split(',')

# 관리자 이메일 (DB 초기화 후 재가입해도 항상 admin)
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', '')