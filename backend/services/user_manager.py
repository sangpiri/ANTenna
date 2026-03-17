"""
사용자 데이터 관리 클래스 (사용자 ID별 폴더/즐겨찾기/메모)
"""
import json
from datetime import datetime
from pathlib import Path


class UserManager:
    """사용자 데이터 관리 클래스"""

    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.cache = {}

    def _get_file_path(self, user_id: str) -> Path:
        """사용자 ID별 데이터 파일 경로"""
        return self.data_dir / f'user_{user_id}.json'

    def _get_default_data(self) -> dict:
        """기본 데이터 구조"""
        return {
            'folders': [{'id': 'default', 'name': '기본 폴더'}],
            'favorites': {'default': []},
            'memos': {}
        }

    def load(self, user_id: str) -> dict:
        """사용자 데이터 로드"""
        if user_id in self.cache:
            return self.cache[user_id]

        file_path = self._get_file_path(user_id)
        if file_path.exists():
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                # 구버전 데이터 마이그레이션
                if 'folders' not in data:
                    old_favorites = data.get('favorites', [])
                    data = self._get_default_data()
                    data['favorites']['default'] = old_favorites if isinstance(old_favorites, list) else []
                self.cache[user_id] = data
                return data
            except Exception as e:
                print(f"데이터 로드 실패 (user {user_id}): {e}")

        data = self._get_default_data()
        self.cache[user_id] = data
        return data

    def save(self, user_id: str):
        """사용자 데이터 저장"""
        if user_id not in self.cache:
            return
        try:
            file_path = self._get_file_path(user_id)
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(self.cache[user_id], f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"데이터 저장 실패 (user {user_id}): {e}")

    # --- 폴더 관리 ---
    def create_folder(self, user_id: str, folder_name: str) -> dict:
        """폴더 생성"""
        data = self.load(user_id)
        folder_id = f'folder_{int(datetime.now().timestamp() * 1000)}'
        new_folder = {'id': folder_id, 'name': folder_name}
        data['folders'].append(new_folder)
        data['favorites'][folder_id] = []
        self.save(user_id)
        return new_folder

    def delete_folder(self, user_id: str, folder_id: str) -> bool:
        """폴더 삭제 (기본 폴더는 삭제 불가)"""
        if folder_id == 'default':
            return False
        data = self.load(user_id)
        data['folders'] = [f for f in data['folders'] if f['id'] != folder_id]
        if folder_id in data['favorites']:
            del data['favorites'][folder_id]
        self.save(user_id)
        return True

    def rename_folder(self, user_id: str, folder_id: str, new_name: str) -> bool:
        """폴더 이름 변경"""
        data = self.load(user_id)
        for folder in data['folders']:
            if folder['id'] == folder_id:
                folder['name'] = new_name
                self.save(user_id)
                return True
        return False

    def reorder_folders(self, user_id: str, folder_ids: list) -> bool:
        """폴더 순서 변경"""
        data = self.load(user_id)
        folder_map = {f['id']: f for f in data['folders']}
        new_folders = []
        for fid in folder_ids:
            if fid in folder_map:
                new_folders.append(folder_map[fid])
        # 혹시 누락된 폴더가 있으면 추가
        for folder in data['folders']:
            if folder['id'] not in folder_ids:
                new_folders.append(folder)
        data['folders'] = new_folders
        self.save(user_id)
        return True

    def get_folders(self, user_id: str) -> list:
        """폴더 목록 반환"""
        data = self.load(user_id)
        result = []
        for folder in data['folders']:
            count = len(data['favorites'].get(folder['id'], []))
            result.append({**folder, 'count': count})
        return result

    # --- 즐겨찾기 관리 ---
    def add_favorite(self, user_id: str, folder_id: str, stock_code: str, stock_name: str, market: str = 'kr') -> bool:
        """폴더에 즐겨찾기 추가"""
        data = self.load(user_id)
        if folder_id not in data['favorites']:
            data['favorites'][folder_id] = []
        # 이미 해당 폴더에 존재하는지 확인
        for fav in data['favorites'][folder_id]:
            if fav['code'] == stock_code and fav.get('market', 'kr') == market:
                return False
        data['favorites'][folder_id].append({
            'code': stock_code,
            'name': stock_name,
            'market': market,
            'added_date': datetime.now().strftime('%Y-%m-%d')
        })
        self.save(user_id)
        return True

    def remove_favorite(self, user_id: str, folder_id: str, stock_code: str, market: str = 'kr') -> bool:
        """폴더에서 즐겨찾기 제거"""
        data = self.load(user_id)
        if folder_id not in data['favorites']:
            return False
        original_len = len(data['favorites'][folder_id])
        data['favorites'][folder_id] = [
            f for f in data['favorites'][folder_id]
            if not (f['code'] == stock_code and f.get('market', 'kr') == market)
        ]
        if len(data['favorites'][folder_id]) < original_len:
            self.save(user_id)
            return True
        return False

    def move_favorite(self, user_id: str, stock_code: str, from_folder: str, to_folder: str, market: str = 'kr') -> bool:
        """즐겨찾기를 다른 폴더로 이동"""
        data = self.load(user_id)
        if from_folder not in data['favorites'] or to_folder not in data['favorites']:
            return False
        # 원본 폴더에서 찾기
        stock_item = None
        for fav in data['favorites'][from_folder]:
            if fav['code'] == stock_code and fav.get('market', 'kr') == market:
                stock_item = fav
                break
        if not stock_item:
            return False
        # 이동
        data['favorites'][from_folder] = [
            f for f in data['favorites'][from_folder]
            if not (f['code'] == stock_code and f.get('market', 'kr') == market)
        ]
        data['favorites'][to_folder].append(stock_item)
        self.save(user_id)
        return True

    def reorder_favorites(self, user_id: str, folder_id: str, favorite_keys: list) -> bool:
        """즐겨찾기 순서 변경 (favorite_keys: ['market_code', ...])"""
        data = self.load(user_id)
        if folder_id not in data['favorites']:
            return False
        fav_map = {f"{f.get('market', 'kr')}_{f['code']}": f for f in data['favorites'][folder_id]}
        new_favorites = []
        for key in favorite_keys:
            if key in fav_map:
                new_favorites.append(fav_map[key])
        # 혹시 누락된 즐겨찾기가 있으면 추가
        for fav in data['favorites'][folder_id]:
            key = f"{fav.get('market', 'kr')}_{fav['code']}"
            if key not in favorite_keys:
                new_favorites.append(fav)
        data['favorites'][folder_id] = new_favorites
        self.save(user_id)
        return True

    def get_favorites(self, user_id: str, folder_id: str) -> list:
        """폴더의 즐겨찾기 목록 반환"""
        data = self.load(user_id)
        return data['favorites'].get(folder_id, [])

    def get_all_favorites(self, user_id: str) -> list:
        """모든 즐겨찾기 목록 반환"""
        data = self.load(user_id)
        all_favorites = []
        for folder_id, favorites in data['favorites'].items():
            for fav in favorites:
                all_favorites.append({**fav, 'folder_id': folder_id})
        return all_favorites

    def is_favorite(self, user_id: str, stock_code: str, market: str = 'kr') -> dict:
        """즐겨찾기 여부 및 폴더 정보 반환"""
        data = self.load(user_id)
        for folder_id, favorites in data['favorites'].items():
            for fav in favorites:
                if fav['code'] == stock_code and fav.get('market', 'kr') == market:
                    folder_name = next((f['name'] for f in data['folders'] if f['id'] == folder_id), '')
                    return {'is_favorite': True, 'folder_id': folder_id, 'folder_name': folder_name}
        return {'is_favorite': False, 'folder_id': None, 'folder_name': None}

    # --- 메모 관리 ---
    def set_memo(self, user_id: str, stock_code: str, memo: str, market: str = 'kr') -> bool:
        """메모 저장"""
        data = self.load(user_id)
        memo_key = f"{market}_{stock_code}"
        data['memos'][memo_key] = {
            'content': memo,
            'updated_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        self.save(user_id)
        return True

    def get_memo(self, user_id: str, stock_code: str, market: str = 'kr') -> str:
        """메모 조회"""
        data = self.load(user_id)
        memo_key = f"{market}_{stock_code}"
        memo_data = data['memos'].get(memo_key, {})
        return memo_data.get('content', '')

    def delete_memo(self, user_id: str, stock_code: str, market: str = 'kr') -> bool:
        """메모 삭제"""
        data = self.load(user_id)
        memo_key = f"{market}_{stock_code}"
        if memo_key in data['memos']:
            del data['memos'][memo_key]
            self.save(user_id)
            return True
        return False

    def get_all_memos(self, user_id: str) -> list:
        """모든 메모 목록 반환"""
        data = self.load(user_id)
        result = []
        for memo_key, memo_data in data['memos'].items():
            parts = memo_key.split('_', 1)
            if len(parts) == 2:
                market, code = parts
            else:
                market, code = 'kr', memo_key
            result.append({
                'code': code,
                'market': market,
                'content': memo_data.get('content', ''),
                'updated_date': memo_data.get('updated_date', '')
            })
        return result
