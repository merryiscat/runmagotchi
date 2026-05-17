/**
 * 루트 레이아웃
 *
 * 모든 페이지의 공통 HTML 구조.
 * Noto Sans KR 폰트를 next/font로 최적화 로드한다.
 */

import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';

/** Noto Sans KR — 한국어 기본 폰트. 400(본문), 700(강조), 900(로고) */
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-noto',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Runmagotchi',
  description: '런닝으로 키우는 나만의 캐릭터',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
