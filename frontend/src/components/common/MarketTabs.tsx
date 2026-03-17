import type { Market } from '../../types/stock';

export type QueryMode = 'basic' | 'advanced' | 'backtest' | 'model-backtest';

interface MarketTabsProps {
  isOpen: boolean;
  onClose: () => void;
  value: Market;
  onChange: (market: Market) => void;
  queryMode: QueryMode;
  onQueryModeChange: (mode: QueryMode) => void;
  onGoHome: () => void;
}

function MarketTabs({ isOpen, onClose, value, onChange, queryMode, onQueryModeChange, onGoHome }: MarketTabsProps) {
  const handleSelect = (market: Market, mode: QueryMode) => {
    onChange(market);
    onQueryModeChange(mode);
    onClose();
  };

  const handleGoHome = () => {
    onGoHome();
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-gray-800 shadow-2xl z-[55] transform transition-transform duration-200 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header - close button only */}
        <div className="flex items-center justify-end px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* HOME 탭 */}
          <button
            onClick={handleGoHome}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors group"
          >
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-white flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-sm font-medium text-gray-200 group-hover:text-white">HOME</span>
          </button>

          <div className="mx-4 border-t border-gray-700" />

          {/* US Section */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="fi fi-us fis rounded-full flex-shrink-0" style={{ width: '20px', height: '20px' }} />
              <span className="text-sm font-medium text-gray-200">미국 주식</span>
            </div>
            <div className="ml-1 space-y-1">
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'us' && queryMode === 'basic'}
                  onChange={() => handleSelect('us', 'basic')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'us' && queryMode === 'basic' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  기본 조회
                </span>
              </label>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'us' && queryMode === 'advanced'}
                  onChange={() => handleSelect('us', 'advanced')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'us' && queryMode === 'advanced' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  고급 조회
                </span>
              </label>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'us' && queryMode === 'backtest'}
                  onChange={() => handleSelect('us', 'backtest')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'us' && queryMode === 'backtest' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  규칙 기반 백테스팅
                </span>
              </label>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'us' && queryMode === 'model-backtest'}
                  onChange={() => handleSelect('us', 'model-backtest')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'us' && queryMode === 'model-backtest' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  모델 기반 백테스팅/신호
                </span>
              </label>
            </div>
          </div>

          <div className="mx-4 border-t border-gray-700" />

          {/* KR Section */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="fi fi-kr fis rounded-full flex-shrink-0" style={{ width: '20px', height: '20px' }} />
              <span className="text-sm font-medium text-gray-200">한국 주식</span>
            </div>
            <div className="ml-1 space-y-1">
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'kr' && queryMode === 'basic'}
                  onChange={() => handleSelect('kr', 'basic')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'kr' && queryMode === 'basic' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  기본 조회
                </span>
              </label>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'kr' && queryMode === 'advanced'}
                  onChange={() => handleSelect('kr', 'advanced')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'kr' && queryMode === 'advanced' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  고급 조회
                </span>
              </label>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'kr' && queryMode === 'backtest'}
                  onChange={() => handleSelect('kr', 'backtest')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'kr' && queryMode === 'backtest' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  규칙 기반 백테스팅
                </span>
              </label>
              <label className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="market-mode"
                  checked={value === 'kr' && queryMode === 'model-backtest'}
                  onChange={() => handleSelect('kr', 'model-backtest')}
                  className="accent-blue-400"
                />
                <span className={`text-sm ${value === 'kr' && queryMode === 'model-backtest' ? 'text-blue-400 font-medium' : 'text-gray-300'}`}>
                  모델 기반 백테스팅/신호
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* 하단 저작권 */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-700">
          <span className="text-xs text-gray-500">© 상피리</span>
        </div>
      </div>
    </>
  );
}

export default MarketTabs;
