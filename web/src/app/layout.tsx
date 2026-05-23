/**
 * 루트 레이아웃
 *
 * 모든 페이지의 공통 HTML 구조.
 * Noto Sans KR 폰트를 next/font로 최적화 로드한다.
 */

import type { Metadata } from 'next';
import { Noto_Sans_KR, Gaegu, Nanum_Pen_Script, Nanum_Myeongjo } from 'next/font/google';
import './globals.css';

/** Noto Sans KR — 한국어 기본 폰트. 400(본문), 700(강조), 900(로고) */
const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-noto',
  display: 'swap',
});

/** Gaegu — 손글씨 폰트. 상점 장부 본문, 가격표 등에 사용 */
const gaegu = Gaegu({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-hand',
  display: 'swap',
});

/** Nanum Pen Script — 펜글씨 폰트. 장부 제목, 강조 텍스트에 사용 */
const nanumPen = Nanum_Pen_Script({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-pen',
  display: 'swap',
});

/** Nanum Myeongjo — 명조 폰트. 도장, 격식체에 사용 */
const nanumMyeongjo = Nanum_Myeongjo({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Runmagotchi',
  description: '런닝으로 키우는 나만의 런닝메이트',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${notoSansKR.variable} ${gaegu.variable} ${nanumPen.variable} ${nanumMyeongjo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
