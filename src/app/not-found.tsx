import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container">
      <div className="card empty">
        <h1>角色不存在</h1>
        <p>它可能已被删除，或链接已经失效。</p>
        <Link className="button primary" href="/">返回角色列表</Link>
      </div>
    </main>
  );
}
