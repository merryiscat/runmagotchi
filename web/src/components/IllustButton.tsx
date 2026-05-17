'use client';

export default function IllustButton({ url }: { url: string }) {
  return (
    <button
      onClick={() => window.open(url, 'illust', 'width=600,height=600,scrollbars=no,resizable=yes')}
      style={{
        position: 'absolute', top: 'var(--s-3)', right: 'var(--s-4)',
        fontSize: 'var(--fs-xs)', color: 'var(--ink-muted)',
        border: '1px solid var(--line)',
        padding: 'var(--s-1) var(--s-2)', background: 'var(--surface)',
        cursor: 'pointer', zIndex: 5, fontFamily: 'inherit',
      }}>
      일러스트
    </button>
  );
}
