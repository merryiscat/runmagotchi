// panels.jsx — composite panel components (stats, runs, dropzone, popup, egg card)

function StatsRow({ kmLabel = '거리', countLabel = '횟수', streakLabel = '일 연속', km, count, streak, period, onPeriodChange }) {
  return (
    <div className="panel__section">
      <div className="row row--between mb-4">
        <span className="text-sm fw-bold">런닝 스탯</span>
        <PeriodSelect
          value={period}
          onChange={onPeriodChange}
          options={['이번 달', '지난 달', '최근 3개월', '올해', '전체', '기간 설정']}
        />
      </div>
      <div className="stats-row">
        <div><div className="stat-v">{km ?? '—'}</div><div className="stat-l">km</div></div>
        <div><div className="stat-v">{count ?? '—'}</div><div className="stat-l">{countLabel === '횟수' ? '회' : countLabel}</div></div>
        <div><div className="stat-v">{streak ?? '—'}</div><div className="stat-l">{streakLabel}</div></div>
      </div>
    </div>
  );
}

function RunRow({ km, pace, minutes, when }) {
  return (
    <div className="run-row">
      <div>
        <div className="text-sm fw-bold">{km} km</div>
        <div className="text-xs text-muted">{pace} /km · {minutes}분</div>
      </div>
      <div className="text-xs text-muted">{when}</div>
    </div>
  );
}

function RunList({ rows, onSeeAll }) {
  return (
    <div className="panel__section" style={{ flex: 1 }}>
      <div className="row row--between mb-3">
        <span className="text-sm fw-bold">최근 기록</span>
        <a className="text-xs text-muted" onClick={onSeeAll} style={{ cursor: 'pointer' }}>전체 보기</a>
      </div>
      {rows.length === 0
        ? <div className="text-sm text-muted" style={{ padding: 'var(--s-3) 0' }}>기록 없음</div>
        : rows.map((r, i) => <RunRow key={i} {...r} />)
      }
    </div>
  );
}

function ExpTrack({ percent = 0 }) {
  return (
    <div className="exp-track">
      <div className="exp-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

function Dropzone({ onFile }) {
  return (
    <div className="dropzone" onClick={onFile}>
      <div className="dropzone-icon">↑</div>
      <div className="text-sm text-muted">스크린샷 드래그 또는 클릭</div>
      <div className="text-xs text-muted">Strava · 나이키런 · 삼성헬스 등</div>
    </div>
  );
}

function DuplicateBlock({ onBack }) {
  return (
    <div style={{ textAlign: 'center', padding: 'var(--s-7) 0' }}>
      <div className="error-dot">✕</div>
      <div className="text-sm fw-bold mb-2">이미 등록된 스크린샷</div>
      <div className="text-xs text-muted mb-5">동일한 이미지는 다시 등록할 수 없음</div>
      <Button onClick={onBack}>다른 이미지 선택</Button>
    </div>
  );
}

function Popup({ title, children }) {
  return (
    <div className="popup-backdrop">
      <div className="popup">
        <div className="popup__title">{title}</div>
        {children}
      </div>
    </div>
  );
}

function EggCard({ palette, selected, onSelect, label }) {
  return (
    <div className={`egg-card ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <div className="egg-card__img">
        <Egg palette={palette} />
      </div>
      <div style={{
        marginTop: 'var(--s-2)', display: 'flex', justifyContent: 'center'
      }}>
        <div style={{
          width: 20, height: 20, border: '1px solid var(--c-3)',
          borderRadius: '50%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 9, color: 'var(--c-3)'
        }}>{label}</div>
      </div>
    </div>
  );
}

Object.assign(window, {
  StatsRow, RunRow, RunList, ExpTrack, Dropzone, DuplicateBlock, Popup, EggCard,
});
