import { useState, Suspense } from 'react';
import type { Market } from './types/stock';
import MarketTabs from './components/common/MarketTabs';
import KrStockView from './components/kr/KrStockView';
import UsStockView from './components/us/UsStockView';
import FavoritesSidebar from './components/common/FavoritesSidebar';
import SearchBar from './components/common/SearchBar';

// 로딩 컴포넌트
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400">로딩 중...</span>
      </div>
    </div>
  );
}

type QueryMode = 'basic' | 'advanced';

function App() {
  const [market, setMarket] = useState<Market>('us');
  const [queryMode, setQueryMode] = useState<QueryMode>('basic');
  const [showFavorites, setShowFavorites] = useState(false);
  const [showLogo, setShowLogo] = useState(false);
  const [selectedFavoriteStock, setSelectedFavoriteStock] = useState<{
    code: string;
    name: string;
  } | null>(null);

  const handleSelectFavoriteStock = (code: string, name: string, stockMarket: Market) => {
    setMarket(stockMarket);
    setSelectedFavoriteStock({ code, name });
    // 즐겨찾기 사이드바는 열어둔 채로 유지
  };

  const clearSelectedFavoriteStock = () => {
    setSelectedFavoriteStock(null);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 헤더 */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* 로고 */}
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="ANTenna"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowLogo(true)}
              />
              <div className="flex flex-col">
                <h1 className="text-base sm:text-xl font-bold text-blue-400 leading-tight">
                  ANTenna
                </h1>
                <span className="text-[10px] sm:text-xs text-gray-400 leading-tight hidden sm:block">
                  Stock Calendar & Search
                </span>
              </div>
            </div>

            {/* 마켓 탭 */}
            <MarketTabs
              value={market}
              onChange={setMarket}
              queryMode={queryMode}
              onQueryModeChange={setQueryMode}
            />

            {/* 우측 메뉴 */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* 검색 버튼 */}
              <SearchBar
                market={market}
                onSelect={(result) => setSelectedFavoriteStock({ code: result.code, name: result.name })}
                placeholder="종목 검색"
              />

              {/* 즐겨찾기 버튼 */}
              <button
                onClick={() => setShowFavorites(!showFavorites)}
                className={`flex items-center justify-center gap-2 w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2 rounded-lg transition-colors ${
                  showFavorites
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  fill={showFavorites ? 'currentColor' : 'none'}
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
                <span className="hidden sm:inline">즐겨찾기</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-[1920px] mx-auto">
        <Suspense fallback={<LoadingSpinner />}>
          {market === 'kr' ? (
            <KrStockView
              selectedFavoriteStock={selectedFavoriteStock}
              onClearFavoriteStock={clearSelectedFavoriteStock}
            />
          ) : (
            <UsStockView
              selectedFavoriteStock={selectedFavoriteStock}
              onClearFavoriteStock={clearSelectedFavoriteStock}
              queryMode={queryMode}
            />
          )}
        </Suspense>
      </main>

      {/* 즐겨찾기 사이드바 */}
      <Suspense fallback={null}>
        <FavoritesSidebar
          isOpen={showFavorites}
          onClose={() => setShowFavorites(false)}
          onSelectStock={handleSelectFavoriteStock}
          market={market}
        />
      </Suspense>

      {/* 로고 모달 */}
      {showLogo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80"
          onClick={() => setShowLogo(false)}
        >
          <div className="relative">
            <img
              src="/logo.png"
              alt="ANTenna"
              className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setShowLogo(false)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
