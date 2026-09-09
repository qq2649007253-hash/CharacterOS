import { CharacterDashboard } from '@/components/CharacterDashboard';
import { TopBar } from '@/components/TopBar';

export default function Home() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="container">
        <section className="hero">
          <div className="eyebrow">A little company, every day</div>
          <h1>今天的心事，有人愿意听。</h1>
          <p>
            和苏晚慢慢聊，和知遥一起向前，或和夏栀发现生活里的小小亮光。你的对话与回忆，留在自己的设备上。
          </p>
        </section>
        <CharacterDashboard />
      </main>
    </div>
  );
}
