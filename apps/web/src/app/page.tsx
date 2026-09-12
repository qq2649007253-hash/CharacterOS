import { CharacterDashboard } from '@/components/CharacterDashboard';
import { TopBar } from '@/components/TopBar';

export default function Home() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="container">
        <section className="hero home-hero">
          <div className="hero-copy">
            <div className="eyebrow"><span /> A quieter kind of company</div>
            <h1>把时间，<br />留给<span>懂你的人。</span></h1>
            <p>世界很热闹。这里，留一点安静给自己。<br />从一句日常开始，让陪伴慢慢发生。</p>
            <a className="hero-link" href="#companions">遇见你的陪伴者 <span aria-hidden="true">↗</span></a>
          </div>
          <div className="hero-note"><span className="note-symbol" aria-hidden="true">✳</span><p>不必急着表达，<br />也不必总有答案。</p><span className="note-caption">A MOMENT, JUST FOR YOU</span></div>
        </section>
        <section id="companions" className="companions-section" aria-label="陪伴角色">
          <div className="collection-heading"><div><span className="eyebrow">THE COMPANIONS</span><h2>相遇，各有温度</h2></div><p>不同的性格，同样认真地倾听。</p></div>
          <CharacterDashboard />
        </section>
        <footer className="home-footer"><span>CharacterOS <i>·</i> 陪伴，在日常里。</span><span>对话与记忆保存在本机</span></footer>
      </main>
    </div>
  );
}
