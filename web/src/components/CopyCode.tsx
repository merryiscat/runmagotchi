/**
 * CopyCode — 코드 클릭 시 클립보드 복사 (클라이언트)
 */

'use client';

import { useState } from 'react';

export default function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick(e: React.MouseEvent) {
    /* 부모 a 태그 이동 방지 */
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <span
      onClick={handleClick}
      style={{
        fontSize: 13,
        color: copied ? 'var(--cheong)' : 'var(--ink-muted)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        borderBottom: '1px dashed var(--line)',
      }}
    >
      #{code} {copied ? '(복사됨)' : ''}
    </span>
  );
}
