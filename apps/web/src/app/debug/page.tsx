import { DebugDashboard } from '@/components/DebugDashboard';
import { TopBar } from '@/components/TopBar';

export const dynamic = 'force-dynamic';

export default function DebugPage() {
  return <div className="app-shell"><TopBar /><DebugDashboard /></div>;
}
