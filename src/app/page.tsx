import { CharacterDashboard } from '@/components/CharacterDashboard';
import { TopBar } from '@/components/TopBar';

export default function Home() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="container">
        <section className="hero">
          <div className="eyebrow">Independent Agent Platform</div>
          <h1>让角色、记忆与本地模型真正属于你。</h1>
          <p>
            CharacterOS 从数据库、模型网关到流式界面独立实现。角色配置保存在本地 SQLite，推理通过本机 Ollama 完成。
          </p>
        </section>
        <CharacterDashboard />
      </main>
    </div>
  );
}
