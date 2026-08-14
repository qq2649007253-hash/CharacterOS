import { notFound } from 'next/navigation';

import { ChatRoom } from '@/components/ChatRoom';
import { characterRepository } from '@/server/repositories/characterRepository';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const character = characterRepository.findById((await params).id);
  if (!character) notFound();
  return <ChatRoom character={character} />;
}
