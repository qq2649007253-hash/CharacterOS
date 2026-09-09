import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';

import './styles.css';

export const metadata: Metadata = {
  description: 'A local-first platform for building persistent character agents.',
  title: 'CharacterOS',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
