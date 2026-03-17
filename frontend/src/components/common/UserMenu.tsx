import { useState, useRef, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  picture_url: string;
  role: 'user' | 'premium' | 'admin';
}

interface UserMenuProps {
  user: User;
  onLogout: () => void;
  onOpenUserManagement: () => void;
}

const ROLE_LABEL: Record<string, string> = {
  user: '일반',
  premium: 'Premium',
  admin: 'Admin',
};

const ROLE_COLOR: Record<string, string> = {
  user: 'text-gray-400',
  premium: 'text-yellow-400',
  admin: 'text-blue-400',
};

export default function UserMenu({ user, onLogout, onOpenUserManagement }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 h-9 px-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
      >
        {user.picture_url ? (
          <img
            src={user.picture_url}
            alt={user.name}
            className="w-6 h-6 rounded-full flex-shrink-0"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {user.name[0]}
          </div>
        )}
        <span className="hidden header-label text-sm text-gray-200 max-w-[80px] truncate">
          {user.name}
        </span>
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
          {/* 사용자 정보 */}
          <div className="px-3 py-2 border-b border-gray-700">
            <p className="text-sm font-medium text-gray-100 truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
            <span className={`text-xs font-medium ${ROLE_COLOR[user.role]}`}>
              {ROLE_LABEL[user.role]}
            </span>
          </div>

          {/* 관리자 메뉴 */}
          {user.role === 'admin' && (
            <button
              onClick={() => { setOpen(false); onOpenUserManagement(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
              </svg>
              사용자 관리
            </button>
          )}

          {/* 로그아웃 */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-red-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
