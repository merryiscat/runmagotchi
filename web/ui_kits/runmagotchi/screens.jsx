// screens.jsx — O1, O2, M1, U1, E1, P1 — full screens for the prototype.

// 3 egg palettes — these stand in for the user's saju-derived 3-color set.
const EGG_PALETTES = [
  ['#E8D8C0', '#9A7B5C', '#3B2A1F'], // earth
  ['#C8DDE8', '#7AA3C1', '#2F4858'], // water
  ['#F4DCDA', '#C58A87', '#6B2A2A'], // fire
];

// ====================== O1 — landing ======================
function ScreenO1({ onLogin }) {
  const [faded, setFaded] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setFaded(true), 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="hero" style={{ minHeight: '80vh' }}>
      <div className={`hero__video-ph ${faded ? 'is-faded' : ''}`}>
        <span style={{ fontSize: 'var(--fs-2xl)' }}>▶</span>
        <span>애니메이션 영상</span>
        <span style={{ fontSize: 'var(--fs-sm)' }}>달리는 사람 + 캐릭터가 함께 성장</span>
      </div>
      <div style={{
        position: 'absolute', top: 'var(--s-5)', left: '50%',
        transform: 'translateX(-50%)', zIndex: 1
      }}>
        <div className="text-sm" style={{ color: 'var(--c-2)' }}>Runmagotchi</div>
      </div>
      {!faded && (
        <div style={{
          position: 'absolute', bottom: 'var(--s-5)', left: '50%',
          transform: 'translateX(-50%)', zIndex: 1
        }}>
          <Button onClick={() => setFaded(true)} style={{ borderColor: 'var(--c-3)', color: 'var(--c-2)' }}>건너뛰기</Button>
        </div>
      )}

      {faded && (
        <div style={{
          position: 'relative', zIndex: 2,
          maxWidth: 420, width: '100%', padding: 'var(--s-5)',
          textAlign: 'center',
          animation: 'fadein 0.8s ease-out',
        }}>
          <div style={{
            fontSize: 40, fontWeight: 900, letterSpacing: '-1px', lineHeight: 1,
            marginBottom: 'var(--s-7)',
          }}>Runmagotchi</div>
          <div className="stack" style={{ gap: 'var(--s-3)' }}>
            <SocialButton provider="google" onClick={onLogin} />
            <SocialButton provider="kakao"  onClick={onLogin} />
            <SocialButton provider="naver"  onClick={onLogin} />
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 'var(--s-5)', lineHeight: 1.6 }}>
            시작하면 <u>이용약관</u> 및 <u>개인정보 처리방침</u>에 동의하게 됩니다.
          </div>
        </div>
      )}
    </div>
  );
}

// ====================== O2 — egg pick ======================
function ScreenO2({ onPick }) {
  const [sel, setSel] = React.useState(1);
  return (
    <Frame style={{ minHeight: '70vh' }}>
      <div className="frame__body" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%' }}>
          <div className="egg-grid">
            {EGG_PALETTES.map((p, i) => (
              <EggCard
                key={i}
                palette={p}
                label={`C${i + 1}`}
                selected={sel === i}
                onSelect={() => setSel(i)}
              />
            ))}
          </div>
          <div className="text-center">
            <Button variant="primary" size="lg"
              onClick={() => onPick(EGG_PALETTES[sel])}
              style={{ minWidth: 200 }}>선택</Button>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ====================== M1 — main dashboard ======================
function ScreenM1({ palette, hatched, charName, gender, runs, totalKm, onNav, onUpload }) {
  const [period, setPeriod] = React.useState('이번 달');

  // character idle wander — purely cosmetic; bounded inside stage box
  const [pos, setPos] = React.useState({ top: '42%', left: '38%' });
  React.useEffect(() => {
    const id = setInterval(() => {
      setPos({
        top: `${30 + Math.random() * 35}%`,
        left: `${20 + Math.random() * 55}%`,
      });
    }, 2400);
    return () => clearInterval(id);
  }, []);

  const stats = React.useMemo(() => {
    const km = runs.reduce((a, r) => a + parseFloat(r.km || 0), 0).toFixed(1);
    return { km, count: runs.length, streak: runs.length ? 3 : 0 };
  }, [runs]);

  return (
    <Frame>
      <GNB activeTab={null} onNav={onNav} />
      <div className="m1-layout">
        <div className="stage">
          <div className="stage__label">스테이지 — 캐릭터 자유 이동</div>
          <div style={{ position: 'absolute', ...pos, width: 110, transition: 'top 1.5s ease-in-out, left 1.5s ease-in-out' }}>
            {hatched
              ? <Character palette={palette} stage="baby" />
              : <Egg palette={palette} />
            }
          </div>
          <div className="stage__footer">
            <div className="fw-bold text-sm">
              <Token>{charName || '{캐릭터 이름}'}</Token>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 'var(--s-1)' }}>
              <Token>{gender || '{성별}'}</Token>
            </div>
          </div>
        </div>

        <div className="panel">
          <StatsRow
            km={stats.km}
            count={stats.count}
            streak={stats.streak}
            period={period}
            onPeriodChange={setPeriod}
          />
          <div className="panel__section">
            <Button variant="primary" size="lg" full onClick={onUpload}>업로드</Button>
          </div>
          <RunList rows={runs.slice(0, 3)} onSeeAll={() => {}} />
        </div>
      </div>
    </Frame>
  );
}

// ====================== U1 — upload flow ======================
function ScreenU1({ onBack, onConfirm }) {
  // states: 'empty' | 'duplicate' | 'parsing' | 'result'
  const [state, setState] = React.useState('empty');
  const [fields, setFields] = React.useState({
    km: '5.2 km', time: '28분 40초', pace: '05:32 /km', date: '2026-05-16'
  });
  const [tries, setTries] = React.useState(0);

  function pickFile() {
    // First "upload" goes through; second triggers the duplicate branch as a demo.
    if (tries === 1) { setState('duplicate'); setTries(2); return; }
    setTries(tries + 1);
    setState('parsing');
    setTimeout(() => setState('result'), 1400);
  }

  return (
    <Frame>
      <div style={{ padding: 'var(--s-5)', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <Topbar title="업로드" onBack={onBack} />

        {state === 'empty' && <Dropzone onFile={pickFile} />}

        {state === 'duplicate' && <DuplicateBlock onBack={() => setState('empty')} />}

        {state === 'parsing' && (
          <div style={{ display: 'flex', gap: 'var(--s-5)', alignItems: 'flex-start' }}>
            <div className="preview">스크린샷</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
              <div className="text-sm text-muted">분석 중...</div>
            </div>
          </div>
        )}

        {state === 'result' && (
          <div style={{ display: 'flex', gap: 'var(--s-5)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="preview">스크린샷</div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <Field label="거리" value={fields.km} editable
                onChange={v => setFields({ ...fields, km: v })} />
              <Field label="시간" value={fields.time} editable
                onChange={v => setFields({ ...fields, time: v })} />
              <Field label="페이스" value={fields.pace} />
              <Field label="날짜" value={fields.date} editable
                onChange={v => setFields({ ...fields, date: v })} />
              <div className="text-xs text-muted mb-4">확정 후 수정·삭제 불가</div>
              <div style={{ display: 'flex', gap: 'var(--s-3)' }}>
                <Button onClick={() => setState('empty')} style={{ flex: 1 }}>취소</Button>
                <Button variant="primary" onClick={() => onConfirm(fields)} style={{ flex: 2 }}>확정</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Frame>
  );
}

// ====================== E1 mode A — hatching sequence ======================
function ScreenE1Hatch({ palette, onName }) {
  const [phase, setPhase] = React.useState('crack1'); // crack1 → crack2 → crack3 → baby
  const [namingOpen, setNamingOpen] = React.useState(false);
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    const order = ['crack1', 'crack2', 'crack3', 'baby'];
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      if (i >= order.length) {
        clearInterval(id);
        setTimeout(() => setNamingOpen(true), 600);
        return;
      }
      setPhase(order[i]);
    }, 1600);
    return () => clearInterval(id);
  }, []);

  const stageLabel = phase === 'crack1' ? '스테이지 — 알 균열 1'
    : phase === 'crack2' ? '스테이지 — 알 균열 2'
    : phase === 'crack3' ? '스테이지 — 대균열 (최종)'
    : '스테이지 — 캐릭터 자유 이동 (유아)';

  return (
    <Frame>
      <GNB activeTab={null} onNav={() => {}} />
      <div className="m1-layout">
        <div className="stage" style={{ position: 'relative' }}>
          <div className="stage__label">{stageLabel}</div>
          <div style={{
            position: 'absolute', top: '38%', left: '36%', width: 110,
          }}>
            {phase === 'crack1' && <EggCracked palette={palette} level={1} />}
            {phase === 'crack2' && <EggCracked palette={palette} level={2} />}
            {phase === 'crack3' && <EggCracked palette={palette} level={3} />}
            {phase === 'baby'   && <Character palette={palette} stage="baby" />}
          </div>
          {phase !== 'baby' && (
            <div className="stage__footer">
              <div className="text-sm fw-bold">부화 중...</div>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel__section">
            <div className="row row--between mb-4">
              <span className="text-sm fw-bold">런닝 스탯</span>
              <select className="period-select"><option>이번 달</option></select>
            </div>
            <div className="stats-row">
              <div><div className="stat-v">10.2</div><div className="stat-l">km</div></div>
              <div><div className="stat-v">3</div><div className="stat-l">회</div></div>
              <div><div className="stat-v">2</div><div className="stat-l">일 연속</div></div>
            </div>
          </div>
          <div className="panel__section">
            <Button variant="primary" size="lg" full>업로드</Button>
          </div>
          <div className="panel__section" style={{ flex: 1 }}>
            <div className="row row--between mb-3">
              <span className="text-sm fw-bold">최근 기록</span>
              <a className="text-xs text-muted">전체 보기</a>
            </div>
            <RunRow km="5.2" pace="05:32" minutes="28" when="오늘" />
          </div>
        </div>
      </div>

      {namingOpen && (
        <Popup title="이름 짓기">
          <div className="text-sm" style={{ textAlign: 'center', padding: 'var(--s-2) 0', color: 'var(--c-2)' }}>
            <Token>{`{성별}`}</Token>
          </div>
          <Input value={name} onChange={setName} maxLength={12} placeholder="2~12자" />
          <div className="text-xs text-muted">변경 불가 · 한글·영문·숫자</div>
          <Button variant="primary" full
            disabled={!name || name.length < 2}
            onClick={() => onName(name)}>확정</Button>
        </Popup>
      )}
    </Frame>
  );
}

// ====================== P1 — profile ======================
function ScreenP1({ palette, hatched, charName, gender, totalKm, runs, titles, onNav, onLogout }) {
  return (
    <Frame>
      <GNB activeTab="profile" onNav={onNav} />
      <div className="p1-layout">
        <div className="p1-sidebar">
          <div className="p1-sidebar__img">
            {hatched ? <Character palette={palette} stage="baby" /> : <Egg palette={palette} />}
          </div>
          <div className="text-sm fw-bold">
            <Token>{charName || '???'}</Token>{' '}
            <span className="text-xs text-muted"><Token>{gender || '???'}</Token></span>
          </div>
          <a className="text-xs text-muted" style={{ marginTop: 'var(--s-1)', cursor: 'pointer' }}
             onClick={onLogout}>로그아웃</a>

          <div style={{ width: '100%', marginTop: 'var(--s-4)' }}>
            <div className="text-xs fw-bold" style={{ marginBottom: 'var(--s-2)' }}>화면 표시</div>
            <div className="list-item" style={{ borderBottom: 'none', padding: 'var(--s-2) 0', gap: 'var(--s-2)' }}>
              <div style={{
                width: 32, height: 32, border: '1px solid var(--c-3)',
                borderRadius: '50%', background: 'var(--c-5)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 4,
              }}>
                {hatched ? <Character palette={palette} stage="baby" /> : <Egg palette={palette} />}
              </div>
              <div style={{ flex: 1, fontSize: 12 }}><Token>{charName || '{이름}'}</Token></div>
              <Toggle on={true} />
            </div>
          </div>
        </div>
        <div className="p1-content">
          <div className="section-head"><span className="text-sm fw-bold">런닝 통계</span></div>
          <div className="info-row"><span className="info-row__label">누적 거리</span>
            <span className="info-row__value"><Token>{totalKm.toFixed(1)}</Token> km</span></div>
          <div className="info-row"><span className="info-row__label">총 횟수</span>
            <span className="info-row__value"><Token>{runs.length}</Token> 회</span></div>
          <div className="info-row"><span className="info-row__label">최장 연속</span>
            <span className="info-row__value"><Token>{runs.length ? '3' : '0'}</Token> 일</span></div>
          <div className="info-row"><span className="info-row__label">PB</span>
            <span className="info-row__value"><Token>{
              runs.length
                ? Math.max(...runs.map(r => parseFloat(r.km))).toFixed(1)
                : '—'
            }</Token> km</span></div>

          <div className="section-head">
            <span className="text-sm fw-bold">칭호</span>
            <span className="text-xs text-muted">{titles.length}개</span>
          </div>
          {titles.length === 0
            ? <div className="info-row"><span className="info-row__label">기록 없음</span></div>
            : titles.map((t, i) => (
                <div key={i} className="info-row">
                  <span className="info-row__label">{t.name}</span>
                  <span className="text-xs text-muted">{t.date}</span>
                </div>
              ))
          }
        </div>
      </div>
    </Frame>
  );
}

Object.assign(window, {
  EGG_PALETTES,
  ScreenO1, ScreenO2, ScreenM1, ScreenU1, ScreenE1Hatch, ScreenP1,
});
