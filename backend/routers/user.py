"""
사용자 데이터 API 라우터 (폴더/즐겨찾기/메모)
"""
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# user_manager는 main.py에서 주입됨
user_manager = None


def set_user_manager(manager):
    """유저 매니저 설정 (main.py에서 호출)"""
    global user_manager
    user_manager = manager


def get_client_ip(request: Request) -> str:
    """클라이언트 IP 추출"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# --- 요청 스키마 ---
class FolderCreateRequest(BaseModel):
    name: str


class FolderDeleteRequest(BaseModel):
    folder_id: str


class FolderRenameRequest(BaseModel):
    folder_id: str
    new_name: str


class FolderReorderRequest(BaseModel):
    folder_ids: list[str]


class FavoriteAddRequest(BaseModel):
    folder_id: str
    code: str
    name: str
    market: str = "kr"


class FavoriteRemoveRequest(BaseModel):
    folder_id: str
    code: str
    market: str = "kr"


class FavoriteMoveRequest(BaseModel):
    code: str
    from_folder: str
    to_folder: str
    market: str = "kr"


class FavoriteReorderRequest(BaseModel):
    folder_id: str
    favorite_keys: list[str]  # ['market_code', ...]


class MemoSaveRequest(BaseModel):
    code: str
    memo: str
    market: str = "kr"


class MemoDeleteRequest(BaseModel):
    code: str
    market: str = "kr"


# --- 폴더 API ---
@router.get("/folders")
async def get_folders(request: Request):
    """폴더 목록 반환"""
    if user_manager is None:
        return []
    client_ip = get_client_ip(request)
    return user_manager.get_folders(client_ip)


@router.post("/folder/create")
async def create_folder(request: Request, body: FolderCreateRequest):
    """폴더 생성"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    folder = user_manager.create_folder(client_ip, body.name)
    return {"success": True, "folder": folder}


@router.post("/folder/delete")
async def delete_folder(request: Request, body: FolderDeleteRequest):
    """폴더 삭제"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.delete_folder(client_ip, body.folder_id)
    return {"success": success}


@router.post("/folder/rename")
async def rename_folder(request: Request, body: FolderRenameRequest):
    """폴더 이름 변경"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.rename_folder(client_ip, body.folder_id, body.new_name)
    return {"success": success}


@router.post("/folder/reorder")
async def reorder_folders(request: Request, body: FolderReorderRequest):
    """폴더 순서 변경"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.reorder_folders(client_ip, body.folder_ids)
    return {"success": success}


# --- 즐겨찾기 API ---
@router.get("/favorites")
async def get_favorites(
    request: Request,
    folder_id: str = Query("default", description="폴더 ID")
):
    """폴더의 즐겨찾기 목록 반환"""
    if user_manager is None:
        return []
    client_ip = get_client_ip(request)
    return user_manager.get_favorites(client_ip, folder_id)


@router.get("/favorites/all")
async def get_all_favorites(request: Request):
    """모든 즐겨찾기 목록 반환"""
    if user_manager is None:
        return []
    client_ip = get_client_ip(request)
    return user_manager.get_all_favorites(client_ip)


@router.post("/favorite/add")
async def add_favorite(request: Request, body: FavoriteAddRequest):
    """즐겨찾기 추가"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.add_favorite(client_ip, body.folder_id, body.code, body.name, body.market)
    return {"success": success}


@router.post("/favorite/remove")
async def remove_favorite(request: Request, body: FavoriteRemoveRequest):
    """즐겨찾기 제거"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.remove_favorite(client_ip, body.folder_id, body.code, body.market)
    return {"success": success}


@router.post("/favorite/move")
async def move_favorite(request: Request, body: FavoriteMoveRequest):
    """즐겨찾기 이동"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.move_favorite(client_ip, body.code, body.from_folder, body.to_folder, body.market)
    return {"success": success}


@router.get("/favorite/check")
async def check_favorite(
    request: Request,
    code: str = Query(..., description="종목코드/티커"),
    market: str = Query("kr", description="마켓 (kr/us)")
):
    """즐겨찾기 여부 확인"""
    if user_manager is None:
        return {"is_favorite": False, "folder_id": None, "folder_name": None}
    client_ip = get_client_ip(request)
    return user_manager.is_favorite(client_ip, code, market)


@router.post("/favorite/reorder")
async def reorder_favorites(request: Request, body: FavoriteReorderRequest):
    """즐겨찾기 순서 변경"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.reorder_favorites(client_ip, body.folder_id, body.favorite_keys)
    return {"success": success}


# --- 메모 API ---
@router.get("/memo")
async def get_memo(
    request: Request,
    code: str = Query(..., description="종목코드/티커"),
    market: str = Query("kr", description="마켓 (kr/us)")
):
    """메모 조회"""
    if user_manager is None:
        return {"memo": ""}
    client_ip = get_client_ip(request)
    memo = user_manager.get_memo(client_ip, code, market)
    return {"memo": memo}


@router.post("/memo/save")
async def save_memo(request: Request, body: MemoSaveRequest):
    """메모 저장"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.set_memo(client_ip, body.code, body.memo, body.market)
    return {"success": success}


@router.post("/memo/delete")
async def delete_memo(request: Request, body: MemoDeleteRequest):
    """메모 삭제"""
    if user_manager is None:
        return {"success": False, "error": "서비스 초기화 중"}
    client_ip = get_client_ip(request)
    success = user_manager.delete_memo(client_ip, body.code, body.market)
    return {"success": success}


@router.get("/memos/all")
async def get_all_memos(request: Request):
    """모든 메모 목록 반환"""
    if user_manager is None:
        return []
    client_ip = get_client_ip(request)
    return user_manager.get_all_memos(client_ip)
