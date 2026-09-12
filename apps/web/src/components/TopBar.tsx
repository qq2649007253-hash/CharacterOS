import { Activity, Sparkle } from 'lucide-react';
import Link from 'next/link';

export function TopBar() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark"><Sparkle size={20} strokeWidth={1.2} /></span>
        <span>CharacterOS</span>
      </Link>
      <div className="topbar-actions">
        <Link className="nav-home" href="/">陪伴空间</Link>
        <span className="muted topbar-motto">让每一次相遇，都有回响</span>
        <Link className="button debug-link" href="/debug"><Activity size={15} /> 调试中心</Link>
      </div>
    </header>
  );
}
