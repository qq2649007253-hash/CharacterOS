import { BrainCircuit } from 'lucide-react';
import Link from 'next/link';

export function TopBar() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <span className="brand-mark"><BrainCircuit size={20} /></span>
        <span>CharacterOS</span>
      </Link>
      <span className="muted">Local-first Agent Runtime</span>
    </header>
  );
}
