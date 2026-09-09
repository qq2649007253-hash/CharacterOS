'use client';

import Link from 'next/link';

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="container"><section className="card empty" role="alert"><h1>暂时没有连接上</h1><p>请确认本地服务已启动，再试一次。已保存的聊天记录不会因此删除。</p><div className="actions"><button className="button primary" type="button" onClick={retry}>重试</button><Link className="button" href="/">返回角色列表</Link></div></section></main>;
}
