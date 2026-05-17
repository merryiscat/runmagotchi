/**
 * 루트 페이지
 *
 * 접속하면 /login으로 리다이렉트한다.
 * 나중에 랜딩 페이지(O1)로 교체 예정.
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}
