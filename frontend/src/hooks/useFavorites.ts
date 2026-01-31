import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../services/api';
import type { Market, Folder, Favorite } from '../types/stock';

// 폴더 목록 조회 훅
export function useFolders() {
  return useQuery({
    queryKey: ['user', 'folders'],
    queryFn: userApi.getFolders,
    staleTime: 1000 * 60 * 5,
  });
}

// 즐겨찾기 목록 조회 훅
export function useFavorites(folderId: string = 'default') {
  return useQuery({
    queryKey: ['user', 'favorites', folderId],
    queryFn: () => userApi.getFavorites(folderId),
    staleTime: 1000 * 60 * 5,
  });
}

// 모든 즐겨찾기 조회 훅
export function useAllFavorites() {
  return useQuery({
    queryKey: ['user', 'favorites', 'all'],
    queryFn: userApi.getAllFavorites,
    staleTime: 1000 * 60 * 5,
  });
}

// 즐겨찾기 여부 확인 훅
export function useFavoriteCheck(code: string, market: Market) {
  return useQuery({
    queryKey: ['user', 'favorite', 'check', code, market],
    queryFn: () => userApi.checkFavorite(code, market),
    staleTime: 1000 * 60 * 1,
  });
}

// 폴더 관리 뮤테이션 훅
export function useFolderMutations() {
  const queryClient = useQueryClient();

  const invalidateFolders = () => {
    queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
  };

  const createFolder = useMutation({
    mutationFn: (name: string) => userApi.createFolder(name),
    onSuccess: invalidateFolders,
  });

  const deleteFolder = useMutation({
    mutationFn: (folderId: string) => userApi.deleteFolder(folderId),
    onSuccess: invalidateFolders,
  });

  const renameFolder = useMutation({
    mutationFn: ({ folderId, newName }: { folderId: string; newName: string }) =>
      userApi.renameFolder(folderId, newName),
    onSuccess: invalidateFolders,
  });

  const reorderFolders = useMutation({
    mutationFn: (folderIds: string[]) => userApi.reorderFolders(folderIds),
    onSuccess: invalidateFolders,
  });

  return { createFolder, deleteFolder, renameFolder, reorderFolders };
}

// 즐겨찾기 관리 뮤테이션 훅
export function useFavoriteMutations() {
  const queryClient = useQueryClient();

  const invalidateFavorites = () => {
    queryClient.invalidateQueries({ queryKey: ['user', 'favorites'] });
    queryClient.invalidateQueries({ queryKey: ['user', 'folders'] });
    queryClient.invalidateQueries({ queryKey: ['user', 'favorite', 'check'] });
  };

  const addFavorite = useMutation({
    mutationFn: ({
      folderId,
      code,
      name,
      market,
    }: {
      folderId: string;
      code: string;
      name: string;
      market: Market;
    }) => userApi.addFavorite(folderId, code, name, market),
    onSuccess: invalidateFavorites,
  });

  const removeFavorite = useMutation({
    mutationFn: ({
      folderId,
      code,
      market,
    }: {
      folderId: string;
      code: string;
      market: Market;
    }) => userApi.removeFavorite(folderId, code, market),
    onSuccess: invalidateFavorites,
  });

  const moveFavorite = useMutation({
    mutationFn: ({
      code,
      fromFolder,
      toFolder,
      market,
    }: {
      code: string;
      fromFolder: string;
      toFolder: string;
      market: Market;
    }) => userApi.moveFavorite(code, fromFolder, toFolder, market),
    onSuccess: invalidateFavorites,
  });

  return { addFavorite, removeFavorite, moveFavorite };
}

// 메모 조회 훅
export function useMemo(code: string, market: Market) {
  return useQuery({
    queryKey: ['user', 'memo', code, market],
    queryFn: () => userApi.getMemo(code, market),
    staleTime: 1000 * 60 * 5,
  });
}

// 메모 관리 뮤테이션 훅
export function useMemoMutations(code: string, market: Market) {
  const queryClient = useQueryClient();

  const invalidateMemo = () => {
    queryClient.invalidateQueries({ queryKey: ['user', 'memo', code, market] });
  };

  const saveMemo = useMutation({
    mutationFn: (memoText: string) => userApi.saveMemo(code, memoText, market),
    onSuccess: invalidateMemo,
  });

  const deleteMemo = useMutation({
    mutationFn: () => userApi.deleteMemo(code, market),
    onSuccess: invalidateMemo,
  });

  return { saveMemo, deleteMemo };
}
