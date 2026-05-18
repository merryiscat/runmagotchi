/**
 * run-sql.mjs — Supabase Management API로 SQL 실행
 *
 * 사용법: node scripts/run-sql.mjs "SELECT 1"
 *
 * .env.local의 SUPABASE_ACCESS_TOKEN + 프로젝트 ref 사용.
 */

import { readFileSync } from 'fs';

// .env.local 직접 파싱
const envText = readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const match = line.match(/^([^#=]+)=(.+)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_URL || !ACCESS_TOKEN) {
  console.error('NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_ACCESS_TOKEN 없음');
  process.exit(1);
}

// 프로젝트 ref 추출 (URL에서)
const ref = SUPABASE_URL.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
if (!ref) { console.error('프로젝트 ref 추출 실패'); process.exit(1); }

// SQL: 인자 또는 stdin
let sql = process.argv.slice(2).join(' ');
if (!sql) sql = readFileSync(0, 'utf-8');
if (!sql?.trim()) { console.error('사용법: node scripts/run-sql.mjs "SQL문"'); process.exit(1); }

// Management API로 SQL 실행
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

if (!res.ok) {
  console.error(`실패 (${res.status}):`, await res.text());
  process.exit(1);
}

const data = await res.json();
console.log(JSON.stringify(data, null, 2));
