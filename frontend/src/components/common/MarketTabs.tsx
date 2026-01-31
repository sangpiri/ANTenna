import { useState, useRef, useEffect } from 'react';
import type { Market } from '../../types/stock';

type QueryMode = 'basic' | 'advanced';

interface MarketTabsProps {
  value: Market;
  onChange: (market: Market) => void;
  queryMode: QueryMode;
  onQueryModeChange: (mode: QueryMode) => void;
}

function MarketTabs({ value, onChange, queryMode, onQueryModeChange }: MarketTabsProps) {
  const [showUsDropdown, setShowUsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUsClick = () => {
    if (value === 'us') {
      // 이미 미국주식 선택 중이면 드롭다운 토글
      setShowUsDropdown(!showUsDropdown);
    } else {
      // 한국주식에서 미국주식으로 전환
      onChange('us');
    }
  };

  const handleModeSelect = (mode: QueryMode) => {
    onQueryModeChange(mode);
    setShowUsDropdown(false);
  };

  const queryModeLabel = queryMode === 'basic' ? '기본' : '고급';

  return (
    <div className="flex bg-gray-700 rounded-lg p-0.5 sm:p-1">
      {/* 미국주식 탭 (드롭다운 포함) */}
      <div ref={dropdownRef} className="relative">
        <button
          onClick={handleUsClick}
          className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors flex items-center gap-1 ${
            value === 'us'
              ? 'bg-blue-400 text-white'
              : 'text-gray-300 hover:text-white hover:bg-gray-600'
          }`}
        >
          <span className="hidden sm:inline">미국주식</span>
          <span className="sm:hidden">미국</span>
          {value === 'us' && (
            <>
              <span className="text-blue-200 text-xs">· {queryModeLabel}</span>
              <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {/* 드롭다운 */}
        {showUsDropdown && value === 'us' && (
          <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-50 min-w-[120px]">
            <button
              onClick={() => handleModeSelect('basic')}
              className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 rounded-t-lg ${
                queryMode === 'basic' ? 'bg-gray-700 text-blue-400' : 'text-gray-300'
              }`}
            >
              기본 조회
            </button>
            <div className="relative group">
              <button
                onClick={() => handleModeSelect('advanced')}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-700 rounded-b-lg ${
                  queryMode === 'advanced' ? 'bg-gray-700 text-blue-400' : 'text-gray-300'
                }`}
              >
                고급 조회
              </button>
              <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute left-full top-0 ml-2 px-3 py-2 bg-gray-900 text-gray-300 text-xs rounded-lg shadow-lg whitespace-nowrap z-[60]">
                갭 상승 이후 주가 변동 등 다양한 고급 분석을 위한 조회
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 한국주식 탭 */}
      <button
        onClick={() => {
          onChange('kr');
          setShowUsDropdown(false);
        }}
        className={`px-3 sm:px-6 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
          value === 'kr'
            ? 'bg-blue-400 text-white'
            : 'text-gray-300 hover:text-white hover:bg-gray-600'
        }`}
      >
        <span className="hidden sm:inline">한국주식</span>
        <span className="sm:hidden">한국</span>
      </button>
    </div>
  );
}

export default MarketTabs;
