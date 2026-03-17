import { useState, useEffect, Suspense } from 'react';
import type { Market } from './types/stock';
import MarketTabs, { type QueryMode } from './components/common/MarketTabs';
import KrStockView from './components/kr/KrStockView';
import UsStockView from './components/us/UsStockView';
import BacktestView from './components/backtest/BacktestView';
import FavoritesSidebar from './components/common/FavoritesSidebar';
import SearchBar from './components/common/SearchBar';
import LoginButton from './components/common/LoginButton';
import UserMenu from './components/common/UserMenu';
import UserManagement from './components/common/UserManagement';
import HomePage from './components/home/HomePage';
import Footer from './components/common/Footer';
import { useAuth } from './hooks/useAuth';

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

function App() {
  const { user, loading: authLoading, logout, setUser } = useAuth();
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showHome, setShowHome] = useState(() => {
    // sessionStorage: 탭 내 새로고침에서 유지, 새 탭/재방문 시 초기화 → 항상 홈 화면부터 시작
    return sessionStorage.getItem('antenna_view') !== 'stock';
  });
  const [market, setMarket] = useState<Market>(() => {
    return (localStorage.getItem('antenna_market') as Market) || 'us';
  });
  const [queryMode, setQueryMode] = useState<QueryMode>(() => {
    return (localStorage.getItem('antenna_queryMode') as QueryMode) || 'basic';
  });

  const handleStart = () => {
    // 시작하기: 항상 미국주식 기본조회로 진입
    sessionStorage.setItem('antenna_view', 'stock');
    setMarket('us');
    setQueryMode('basic');
    setShowHome(false);
  };

  const handleGoHome = () => {
    sessionStorage.removeItem('antenna_view');
    setShowHome(true);
  };

  useEffect(() => {
    localStorage.setItem('antenna_market', market);
    localStorage.setItem('antenna_queryMode', queryMode);
  }, [market, queryMode]);

  const [showFavorites, setShowFavorites] = useState(false);
  const [showMarketSidebar, setShowMarketSidebar] = useState(false);
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
      {/* 홈페이지 모드 */}
      {showHome ? (
        <>
          <HomePage onStart={handleStart} />
          <Footer />
        </>
      ) : (
      <>
      {/* 헤더 */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-[1920px] mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between h-12 sm:h-14">
            {/* 좌측: 로고 */}
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="ANTenna"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setShowLogo(true)}
              />
              <button
                onClick={() => setShowMarketSidebar(true)}
                className="flex flex-col items-start hover:opacity-70 transition-opacity"
                aria-label="시장 선택"
              >
                <h1 className="text-base sm:text-xl font-bold text-blue-400 leading-tight">
                  ANTenna
                </h1>
                <span className="text-[10px] sm:text-xs text-gray-400 leading-tight hidden header-label-block">
                  Stock Calendar & Search & Backtesting
                </span>
              </button>
            </div>

            {/* 우측 메뉴 */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* 현재 시장 뱃지 */}
              <button
                onClick={() => setShowMarketSidebar(true)}
                className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg px-2 sm:px-3 h-9 text-xs sm:text-sm transition-colors whitespace-nowrap flex-shrink-0"
              >
                <span
                  className={`fi fi-${market} fis rounded-full flex-shrink-0`}
                  style={{ width: '18px', height: '18px' }}
                />
                <span className="hidden header-label">{market === 'us' ? '미국 주식' : '한국 주식'}</span>
                <span className="hidden header-label text-blue-300 text-xs">
                · {queryMode === 'basic' ? '기본' : queryMode === 'advanced' ? '고급' : queryMode === 'backtest' ? '규칙 기반 백테스팅' : '모델 기반'}
              </span>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* 검색 버튼 */}
              <SearchBar
                market={market}
                onSelect={(result) => setSelectedFavoriteStock({ code: result.code, name: result.name })}
                placeholder="종목 검색"
              />

              {/* 즐겨찾기 버튼 (로그인 시에만 활성화) */}
              <button
                onClick={() => user && setShowFavorites(!showFavorites)}
                title={!user ? '로그인 후 이용 가능합니다' : ''}
                className={`flex items-center justify-center gap-2 h-9 px-2.5 sm:px-4 rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                  !user
                    ? 'bg-gray-700 text-gray-600 cursor-not-allowed'
                    : showFavorites
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
                <span className="hidden header-label">즐겨찾기</span>
              </button>

              {/* 로그인 / 유저 메뉴 */}
              {!authLoading && (
                user ? (
                  <UserMenu
                    user={user}
                    onLogout={logout}
                    onOpenUserManagement={() => setShowUserManagement(true)}
                  />
                ) : (
                  <LoginButton onLogin={setUser} />
                )
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-[1920px] mx-auto">
        <Suspense fallback={<LoadingSpinner />}>
          {queryMode === 'model-backtest' ? (
            <div className="flex items-center justify-center h-96">
              <span className="text-gray-400 text-base">관리자만 이용할 수 있습니다.</span>
            </div>
          ) : queryMode === 'backtest' ? (
            <BacktestView market={market} user={user} />
          ) : market === 'kr' ? (
            <KrStockView
              selectedFavoriteStock={selectedFavoriteStock}
              onClearFavoriteStock={clearSelectedFavoriteStock}
              queryMode={queryMode}
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

      {/* 시장 선택 사이드바 */}
      <MarketTabs
        isOpen={showMarketSidebar}
        onClose={() => setShowMarketSidebar(false)}
        value={market}
        onChange={setMarket}
        queryMode={queryMode}
        onQueryModeChange={setQueryMode}
        onGoHome={handleGoHome}
      />

      {/* 즐겨찾기 사이드바 */}
      <Suspense fallback={null}>
        <FavoritesSidebar
          isOpen={!!user && showFavorites}
          onClose={() => setShowFavorites(false)}
          onSelectStock={handleSelectFavoriteStock}
          market={market}
        />
      </Suspense>

      {/* 사용자 관리 모달 (admin) */}
      {showUserManagement && (
        <UserManagement onClose={() => setShowUserManagement(false)} />
      )}

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
      </>
      )}
    </div>
  );
}

export default App;
