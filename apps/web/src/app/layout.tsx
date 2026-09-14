import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import './styles.css';
import { AuthGate } from '@/components/AuthGate';

export const metadata: Metadata = {
  description: 'A local-first platform for building persistent character agents.',
  title: 'CharacterOS',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <body><AuthGate>{children}</AuthGate></body>
    </html>
  );
}
