'use client';
import Link from 'next/link';
// A full navigation on account changes discards all previous-account client state.
/* eslint-disable @next/next/no-location-assign-relative-destination */
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
type User = { id: string; username: string; role: 'admin' | 'user' };
const AuthContext = createContext<User | null>(null);
export const useUser = () => useContext(AuthContext);
export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [setup, setSetup] = useState(false);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pathname = usePathname();
  const check = async () => {
    try { const r = await fetch('/api/auth/me', { cache: 'no-store' }); if (!r.ok) throw new Error(); const data = await r.json(); setUser(data.user); setSetup(data.needsSetup); setReady(true); }
    catch { setError('无法连接账号服务，请稍后重试。'); }
  };
  // State changes happen after the account-service network response.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void check(); const refresh = () => void check(); window.addEventListener('focus', refresh); const timer = window.setInterval(refresh, 60000); return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer); }; }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const r = await fetch('/api/auth/' + (setup ? 'setup' : register ? 'register' : 'login'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error); window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : '登录失败'); } finally { setBusy(false); }
  }
  if (!ready) return <main className="auth-shell"><p>{error || '正在连接你的空间…'}</p>{error && <button className="button" onClick={() => void check()}>重试</button>}</main>;
  if (!user) return <main className="auth-shell"><form className="card auth-card" onSubmit={submit}><div className="eyebrow">CHARACTEROS · YOUR OWN SPACE</div><h1>{setup ? '建立你的空间' : register ? '开始一段新相遇' : '欢迎回来'}</h1><p className="muted">{setup ? '设置首个管理员账号。原有角色与聊天记录将保留在此账号。' : '登录后，继续属于你的对话与回忆。'}</p><label className="field">用户名<input className="input" name="username" autoComplete="username" pattern="[a-zA-Z0-9_]{3,32}" minLength={3} maxLength={32} required /></label><p className="field-hint">3–32 位字母、数字或下划线</p><label className="field">密码<input className="input" name="password" type="password" autoComplete={setup || register ? 'new-password' : 'current-password'} minLength={10} maxLength={128} required /></label><p className="field-hint">至少 10 位，请勿与其他网站共用密码</p>{error && <p className="error" role="alert">{error}</p>}<button className="button primary full-button" disabled={busy}>{busy ? '请稍候…' : setup ? '创建管理员账号' : register ? '注册普通账号' : '登录'}</button>{!setup && <button className="button full-button" type="button" onClick={() => { setRegister(!register); setError(''); }}>{register ? '已有账号，去登录' : '没有账号？注册'}</button>}<p className="field-hint">账号与数据存储在本机。在线朗读会将待朗读文字发送给微软。</p></form></main>;
  if ((pathname === '/debug' || pathname === '/admin') && user.role !== 'admin') return <main className="auth-shell"><h1>仅管理员可访问</h1><Link className="button" href="/">返回陪伴空间</Link></main>;
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
export function AccountMenu() {
  const user = useUser();
  const [error, setError] = useState('');
  return <div className="account-menu"><span>{user?.username} · {user?.role === 'admin' ? '管理员' : '普通用户'}</span>{user?.role === 'admin' && <><Link href="/admin">账号管理</Link><Link href="/debug">调试中心</Link></>}<button className="button" onClick={async () => { try { const r = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!r.ok) throw new Error(); window.location.assign('/'); } catch { setError('退出失败，请重试'); } }}>退出</button>{error && <span role="alert">{error}</span>}</div>;
}
