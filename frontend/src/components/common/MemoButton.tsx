import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/api';
import type { Market } from '../../types/stock';

interface MemoButtonProps {
  code: string;
  market: Market;
}

function MemoButton({ code, market }: MemoButtonProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [memoText, setMemoText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 메모 조회
  const { data: memoData } = useQuery({
    queryKey: ['user', 'memo', code, market],
    queryFn: () => userApi.getMemo(code, market),
  });

  // 메모 저장
  const saveMutation = useMutation({
    mutationFn: () => userApi.saveMemo(code, memoText, market),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'memo', code, market] });
      setIsOpen(false);
    },
  });

  // 메모 삭제
  const deleteMutation = useMutation({
    mutationFn: () => userApi.deleteMemo(code, market),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'memo', code, market] });
      setMemoText('');
      setIsOpen(false);
    },
  });

  // 모달 열릴 때 메모 텍스트 초기화
  useEffect(() => {
    if (isOpen && memoData) {
      setMemoText(memoData.memo || '');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, memoData]);

  const hasMemo = memoData?.memo && memoData.memo.length > 0;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(true)}
        className={`p-2 rounded hover:bg-gray-700 transition-colors ${
          hasMemo ? 'text-green-400' : 'text-gray-400 hover:text-green-400'
        }`}
        title={hasMemo ? '메모 보기' : '메모 작성'}
      >
        <svg
          className="w-5 h-5"
          fill={hasMemo ? 'currentColor' : 'none'}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>

      {/* 메모 모달 */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 w-80">
            <div className="p-3 border-b border-gray-700 flex items-center justify-between">
              <span className="font-medium">메모</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-3">
              <textarea
                ref={textareaRef}
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder="메모를 입력하세요."
                className="w-full h-32 bg-gray-700 border border-gray-600 rounded p-2 text-sm resize-none focus:outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={!hasMemo}
                  className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  삭제
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={!memoText.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default MemoButton;
