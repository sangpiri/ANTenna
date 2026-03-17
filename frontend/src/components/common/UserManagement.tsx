import { useState, useEffect } from 'react';
import api from '../../services/api';

interface UserRow {
  id: number;
  name: string;
  email: string;
  picture_url: string;
  role: 'user' | 'premium' | 'admin';
  created_at: string;
  last_login_at: string | null;
}

interface UserManagementProps {
  onClose: () => void;
}

const ROLES: Array<'user' | 'premium' | 'admin'> = ['user', 'premium', 'admin'];

const ROLE_COLOR: Record<string, string> = {
  user: 'text-gray-300',
  premium: 'text-yellow-400',
  admin: 'text-blue-400',
};

function formatDate(iso: string | null) {
  if (!iso) return '-';
  return iso.slice(0, 10);
}

export default function UserManagement({ onClose }: UserManagementProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    api.get('/api/admin/users')
      .then(res => setUsers(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const changeRole = async (userId: number, newRole: string) => {
    setSaving(userId);
    try {
      await api.post(`/api/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as UserRow['role'] } : u));
    } catch (e) {
      console.error('권한 변경 실패:', e);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-100">사용자 관리</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-400 py-10 text-sm">사용자가 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-xs">
                  <th className="px-4 py-2 text-left font-medium">이름</th>
                  <th className="px-4 py-2 text-left font-medium">이메일</th>
                  <th className="px-4 py-2 text-left font-medium">가입일</th>
                  <th className="px-4 py-2 text-left font-medium">최근 로그인</th>
                  <th className="px-4 py-2 text-left font-medium">권한</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {u.picture_url ? (
                          <img src={u.picture_url} alt={u.name} className="w-6 h-6 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {u.name[0]}
                          </div>
                        )}
                        <span className="text-gray-200 truncate max-w-[80px]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 truncate max-w-[150px]">{u.email}</td>
                    <td className="px-4 py-2.5 text-gray-400">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-2.5 text-gray-400">{formatDate(u.last_login_at)}</td>
                    <td className="px-4 py-2.5">
                      <select
                        value={u.role}
                        disabled={saving === u.id}
                        onChange={e => changeRole(u.id, e.target.value)}
                        className={`bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 ${ROLE_COLOR[u.role]} disabled:opacity-50`}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
