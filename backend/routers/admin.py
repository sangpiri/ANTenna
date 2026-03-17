from fastapi import APIRouter, Request, HTTPException
from services.auth_service import require_role

router = APIRouter()


@router.get("/users")
async def get_users(request: Request):
    """전체 사용자 목록 (admin만)"""
    require_role(request, 'admin')
    db = request.app.state.db_pool
    rows = await db.fetch("""
        SELECT id, email, name, picture_url, role, created_at, last_login_at
        FROM users ORDER BY created_at DESC
    """)
    return [dict(r) for r in rows]


@router.post("/users/{user_id}/role")
async def update_user_role(user_id: int, request: Request):
    """사용자 권한 변경 (admin만)"""
    require_role(request, 'admin')
    body = await request.json()
    new_role = body.get('role')
    if new_role not in ('user', 'premium', 'admin'):
        raise HTTPException(400, "유효하지 않은 role")

    db = request.app.state.db_pool
    await db.execute("UPDATE users SET role = $1 WHERE id = $2", new_role, user_id)
    return {"ok": True}
