import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/api';
import type { Market } from '../../types/stock';

interface FavoriteButtonProps {
  code: string;
  name: string;
  market: Market;
}

function FavoriteButton({ code, name, market }: FavoriteButtonProps) {
  const queryClient = useQueryClient();
  const [showFolderSelect, setShowFolderSelect] = useState(false);

  // 즐겨찾기 여부 확인
  const { data: favoriteStatus } = useQuery({
    queryKey: ['user', 'favorite', 'check', code, market],
    queryFn: () => userApi.checkFavorite(code, market),
  });

  // 폴더 목록 (마켓별 카운트)
  const { data: folders = [] } = useQuery({
    queryKey: ['user', 'folders', market],
    queryFn: async () => {
      const allFolders = await userApi.getFolders();
      const foldersWithCount = await Promise.all(
        allFolders.map(async (folder) => {
          const favorites = await userApi.getFavorites(folder.id);
          const marketCount = favorites.filter(f => f.market === market).length;
          return { ...folder, count: marketCount };
        })
      );
      return foldersWithCount;
    },
    enabled: showFolderSelect,
  });

  // 즐겨찾기 추가
  const addMutation = useMutation({
    mutationFn: (folderId: string) => userApi.addFavorite(folderId, code, name, market),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorite', 'check', code, market] });
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
      setShowFolderSelect(false);
    },
  });

  // 즐겨찾기 제거
  const removeMutation = useMutation({
    mutationFn: () => userApi.removeFavorite(favoriteStatus?.folder_id || 'default', code, market),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorite', 'check', code, market] });
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
    },
  });

  const isFavorite = favoriteStatus?.is_favorite;

  const handleClick = () => {
    if (isFavorite) {
      removeMutation.mutate();
    } else {
      setShowFolderSelect(true);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`p-2 rounded hover:bg-gray-700 transition-colors ${
          isFavorite ? 'text-yellow-400' : 'text-gray-400 hover:text-yellow-400'
        }`}
        title={isFavorite ? `즐겨찾기 해제 (${favoriteStatus?.folder_name})` : '즐겨찾기 추가'}
      >
        <svg
          className="w-5 h-5"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
      </button>

      {/* 폴더 선택 드롭다운 */}
      {showFolderSelect && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowFolderSelect(false)}
          />
          <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 min-w-[150px]">
            <div className="py-1">
              <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
                폴더 선택
              </div>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => addMutation.mutate(folder.id)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 flex items-center justify-between"
                >
                  <span>{folder.name}</span>
                  <span className="text-xs text-gray-400">{folder.count}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default FavoriteButton;
