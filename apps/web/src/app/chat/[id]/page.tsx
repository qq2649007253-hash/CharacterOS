import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ChatRoom } from '@/components/ChatRoom';
import type { Character } from '@characteros/contracts/character';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const response = await fetch(`${process.env.CHARACTEROS_API_URL || 'http://127.0.0.1:4318'}/api/characters/${encodeURIComponent((await params).id)}`, { cache: 'no-store', headers: { cookie: (await cookies()).toString() } });
  if (response.status === 401) redirect('/');
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error('角色服务暂时不可用');
  const character: Character = await response.json();
  return <ChatRoom key={character.id} character={character} />;
}

