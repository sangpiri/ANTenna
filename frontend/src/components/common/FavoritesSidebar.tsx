import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/api';
import type { Market } from '../../types/stock';

interface FavoritesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStock: (code: string, name: string, market: Market) => void;
  market: Market;
}

function FavoritesSidebar({ isOpen, onClose, onSelectStock, market }: FavoritesSidebarProps) {
  const queryClient = useQueryClient();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [draggedFavoriteKey, setDraggedFavoriteKey] = useState<string | null>(null);
  const [dragOverFavoriteKey, setDragOverFavoriteKey] = useState<string | null>(null);
  const [movingFavorite, setMovingFavorite] = useState<{ code: string; name: string } | null>(null);

  // 폴더 목록 조회 (마켓별 카운트 포함)
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
  });

  // 현재 폴더의 즐겨찾기 목록 조회 (마켓 필터링)
  const { data: favorites = [] } = useQuery({
    queryKey: ['user', 'favorites', currentFolderId, market],
    queryFn: async () => {
      if (!currentFolderId) return [];
      const allFavorites = await userApi.getFavorites(currentFolderId);
      return allFavorites.filter(f => f.market === market);
    },
    enabled: !!currentFolderId,
  });

  // 현재 폴더 정보
  const currentFolder = folders.find(f => f.id === currentFolderId);

  // 폴더 생성
  const createFolderMutation = useMutation({
    mutationFn: (name: string) => userApi.createFolder(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
      setIsCreatingFolder(false);
      setNewFolderName('');
    },
  });

  // 폴더 삭제
  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => userApi.deleteFolder(folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
      setCurrentFolderId(null);
    },
  });

  // 폴더 이름 변경
  const renameFolderMutation = useMutation({
    mutationFn: ({ folderId, newName }: { folderId: string; newName: string }) =>
      userApi.renameFolder(folderId, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
      setEditingFolderId(null);
      setEditingName('');
    },
  });

  // 폴더 순서 변경
  const reorderFoldersMutation = useMutation({
    mutationFn: (folderIds: string[]) => userApi.reorderFolders(folderIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
    },
  });

  // 폴더 드래그 앤 드롭 핸들러
  const handleDragStart = (e: React.DragEvent, folderId: string) => {
    setDraggedFolderId(folderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedFolderId !== folderId) {
      setDragOverFolderId(folderId);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    if (!draggedFolderId || draggedFolderId === targetFolderId) {
      setDraggedFolderId(null);
      setDragOverFolderId(null);
      return;
    }

    const draggedIndex = folders.findIndex(f => f.id === draggedFolderId);
    const targetIndex = folders.findIndex(f => f.id === targetFolderId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newFolders = [...folders];
    const [removed] = newFolders.splice(draggedIndex, 1);
    newFolders.splice(targetIndex, 0, removed);

    reorderFoldersMutation.mutate(newFolders.map(f => f.id));
    setDraggedFolderId(null);
    setDragOverFolderId(null);
  };

  const handleDragEnd = () => {
    setDraggedFolderId(null);
    setDragOverFolderId(null);
  };

  // 즐겨찾기 순서 변경
  const reorderFavoritesMutation = useMutation({
    mutationFn: (favoriteKeys: string[]) => userApi.reorderFavorites(currentFolderId!, favoriteKeys),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
    },
  });

  // 즐겨찾기 드래그 앤 드롭 핸들러
  const handleFavDragStart = (e: React.DragEvent, code: string) => {
    const key = `${market}_${code}`;
    setDraggedFavoriteKey(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFavDragOver = (e: React.DragEvent, code: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const key = `${market}_${code}`;
    if (draggedFavoriteKey !== key) {
      setDragOverFavoriteKey(key);
    }
  };

  const handleFavDragLeave = () => {
    setDragOverFavoriteKey(null);
  };

  const handleFavDrop = (e: React.DragEvent, targetCode: string) => {
    e.preventDefault();
    const targetKey = `${market}_${targetCode}`;
    if (!draggedFavoriteKey || draggedFavoriteKey === targetKey) {
      setDraggedFavoriteKey(null);
      setDragOverFavoriteKey(null);
      return;
    }

    const draggedIndex = favorites.findIndex(f => `${f.market}_${f.code}` === draggedFavoriteKey);
    const targetIndex = favorites.findIndex(f => `${f.market}_${f.code}` === targetKey);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newFavorites = [...favorites];
    const [removed] = newFavorites.splice(draggedIndex, 1);
    newFavorites.splice(targetIndex, 0, removed);

    reorderFavoritesMutation.mutate(newFavorites.map(f => `${f.market}_${f.code}`));
    setDraggedFavoriteKey(null);
    setDragOverFavoriteKey(null);
  };

  const handleFavDragEnd = () => {
    setDraggedFavoriteKey(null);
    setDragOverFavoriteKey(null);
  };

  // 즐겨찾기 제거
  const removeFavoriteMutation = useMutation({
    mutationFn: (code: string) => userApi.removeFavorite(currentFolderId!, code, market),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
    },
  });

  // 즐겨찾기 폴더 이동
  const moveFavoriteMutation = useMutation({
    mutationFn: ({ code, toFolder }: { code: string; toFolder: string }) =>
      userApi.moveFavorite(code, currentFolderId!, toFolder, market),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
      queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
      setMovingFavorite(null);
    },
  });

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolderMutation.mutate(newFolderName.trim());
    }
  };

  const handleRenameFolder = (folderId: string) => {
    if (editingName.trim()) {
      renameFolderMutation.mutate({ folderId, newName: editingName.trim() });
    }
  };

  const handleFolderClick = (folderId: string) => {
    if (editingFolderId) return;
    setCurrentFolderId(folderId);
  };

  const handleBack = () => {
    setCurrentFolderId(null);
    setMovingFavorite(null);
  };

  const handleMoveToFolder = (toFolderId: string) => {
    if (movingFavorite && currentFolderId) {
      moveFavoriteMutation.mutate({ code: movingFavorite.code, toFolder: toFolderId });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 모바일 백드롭 */}
      <div
        className="fixed inset-0 bg-black/50 z-30 sm:hidden"
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full sm:w-80 bg-gray-800 shadow-xl z-40 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-base sm:text-lg truncate max-w-[200px]">
              {currentFolderId ? currentFolder?.name : '즐겨찾기'}
            </h2>
            <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${
              market === 'us' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'
            }`}>
              {market === 'us' ? '미국' : '한국'}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-700 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

      {/* 뒤로가기 버튼 (폴더 안에 있을 때) */}
      {currentFolderId && !movingFavorite && (
        <button
          onClick={handleBack}
          className="flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-gray-700 border-b border-gray-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          폴더 목록으로 돌아가기
        </button>
      )}

      {/* 폴더 이동 모드 */}
      {movingFavorite && (
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3 bg-gray-700 border-b border-gray-600">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-white">{movingFavorite.name}</span>을(를) 이동할 폴더 선택
            </p>
          </div>
          <button
            onClick={() => setMovingFavorite(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:bg-gray-700 border-b border-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            취소
          </button>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {folders
              .filter(f => f.id !== currentFolderId)
              .map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => handleMoveToFolder(folder.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded hover:bg-gray-700 text-left"
                >
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span>{folder.name}</span>
                  <span className="ml-auto text-sm text-gray-400">{folder.count}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 폴더 목록 뷰 */}
      {!currentFolderId && !movingFavorite && (
        <div className="flex-1 overflow-y-auto">
          {/* 새 폴더 버튼 */}
          <div className="p-2 border-b border-gray-700">
            {isCreatingFolder ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="폴더 이름"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                />
                <button
                  onClick={handleCreateFolder}
                  className="px-2 py-1 bg-blue-600 rounded text-sm hover:bg-blue-500"
                >
                  추가
                </button>
                <button
                  onClick={() => {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }}
                  className="px-2 py-1 bg-gray-600 rounded text-sm hover:bg-gray-500"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-gray-700 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                새 폴더 만들기
              </button>
            )}
          </div>

          {/* 폴더 리스트 */}
          <div className="p-2 space-y-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                draggable={!editingFolderId}
                onDragStart={(e) => handleDragStart(e, folder.id)}
                onDragOver={(e) => handleDragOver(e, folder.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, folder.id)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center justify-between px-3 py-3 rounded cursor-pointer transition-colors ${
                  draggedFolderId === folder.id ? 'opacity-50' : ''
                } ${dragOverFolderId === folder.id ? 'border-2 border-blue-400' : ''} hover:bg-gray-700`}
                onClick={() => handleFolderClick(folder.id)}
              >
                {editingFolderId === folder.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="flex-1 bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameFolder(folder.id);
                      if (e.key === 'Escape') {
                        setEditingFolderId(null);
                        setEditingName('');
                      }
                    }}
                    onBlur={() => handleRenameFolder(folder.id)}
                  />
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span>{folder.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">{folder.count}</span>
                      <div className="hidden group-hover:flex items-center gap-1">
                        {/* 이름 변경 버튼 - 모든 폴더에 표시 */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFolderId(folder.id);
                            setEditingName(folder.name);
                          }}
                          className="p-1 hover:bg-gray-600 rounded"
                          title="이름 변경"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {/* 삭제 버튼 - 기본 폴더는 삭제 불가 */}
                        {folder.id !== 'default' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm('폴더를 삭제하시겠습니까?')) {
                                deleteFolderMutation.mutate(folder.id);
                              }
                            }}
                            className="p-1 hover:bg-red-600 rounded"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 종목 목록 뷰 */}
      {currentFolderId && !movingFavorite && (
        <div className="flex-1 overflow-y-auto">
          {favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <p className="text-sm">즐겨찾기가 없습니다</p>
              <p className="text-xs mt-1">차트에서 별 아이콘을 클릭하여 추가하세요</p>
            </div>
          ) : (
            <ul className="p-2 space-y-1">
              {favorites.map((fav, index) => {
                const favKey = `${fav.market}_${fav.code}`;
                return (
                  <li
                    key={favKey}
                    draggable
                    onDragStart={(e) => handleFavDragStart(e, fav.code)}
                    onDragOver={(e) => handleFavDragOver(e, fav.code)}
                    onDragLeave={handleFavDragLeave}
                    onDrop={(e) => handleFavDrop(e, fav.code)}
                    onDragEnd={handleFavDragEnd}
                    className={`group flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-700 cursor-grab active:cursor-grabbing ${
                      draggedFavoriteKey === favKey ? 'opacity-50' : ''
                    } ${dragOverFavoriteKey === favKey ? 'border-2 border-blue-400' : ''}`}
                    onClick={() => onSelectStock(fav.code, fav.name, market)}
                  >
                    <span className="text-gray-500 text-sm w-6 text-right flex-shrink-0">{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{fav.name}</div>
                      <div className="text-sm font-mono text-yellow-400">{fav.code}</div>
                    </div>
                    <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
                      {/* 폴더 이동 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMovingFavorite({ code: fav.code, name: fav.name });
                        }}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="폴더 이동"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavoriteMutation.mutate(fav.code);
                        }}
                        className="p-1 hover:bg-red-600 rounded"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
    </>
  );
}

export default FavoritesSidebar;
