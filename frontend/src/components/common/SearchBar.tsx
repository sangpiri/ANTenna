import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { krApi, usApi } from '../../services/api';
import type { Market, SearchResult } from '../../types/stock';

interface SearchBarProps {
  market: Market;
  onSelect: (result: SearchResult) => void;
  placeholder?: string;
}

function SearchBar({ market, onSelect, placeholder = '종목 검색' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 검색 쿼리
  const { data: results = [], isLoading } = useQuery({
    queryKey: [market, 'search', query],
    queryFn: () => (market === 'kr' ? krApi : usApi).search(query, 20),
    enabled: query.length >= 1,
    staleTime: 1000 * 60, // 1분
  });

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // 검색어가 없으면 접기
        if (!query) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query]);

  // 확장 시 input에 포커스
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      setIsExpanded(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
    }
  };

  const handleSelect = (result: SearchResult) => {
    onSelect(result);
    setQuery('');
    setIsOpen(false);
    setIsExpanded(false);
    setSelectedIndex(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedIndex(0);
  };

  const handleIconClick = () => {
    setIsExpanded(true);
  };

  const handleClose = () => {
    setQuery('');
    setIsOpen(false);
    setIsExpanded(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 접힌 상태: 검색 아이콘만 표시 */}
      {!isExpanded && (
        <button
          onClick={handleIconClick}
          className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          title="종목 검색"
        >
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      )}

      {/* 확장된 상태: 검색 입력창 */}
      {isExpanded && (
        <div className="flex items-center gap-2 flex-row-reverse">
          {/* 닫기 버튼 */}
          <button
            onClick={handleClose}
            className="flex items-center justify-center w-9 h-9 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0"
            title="닫기"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onFocus={() => query && setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-48 sm:w-64 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pl-10 text-sm
                         placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {/* 검색 결과 드롭다운 */}
            {isOpen && query && (
              <div className="absolute top-full right-0 w-48 sm:w-64 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg overflow-hidden z-50">
                {isLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-400">검색 중...</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">검색 결과가 없습니다</div>
                ) : (
                  <ul className="max-h-64 overflow-y-auto">
                    {results.map((result, index) => (
                      <li
                        key={result.code}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`px-4 py-2 cursor-pointer flex items-center justify-between ${
                          index === selectedIndex ? 'bg-gray-700' : 'hover:bg-gray-700/50'
                        }`}
                      >
                        <span className="font-medium truncate">{result.name}</span>
                        <span className="text-sm text-yellow-400 font-mono ml-2">{result.code}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBar;
