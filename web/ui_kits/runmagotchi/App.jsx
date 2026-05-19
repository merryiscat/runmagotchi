// App.jsx — router + state for the prototype.
// State is intentionally in-memory only; this is a UI kit, not the real app.

function App() {
  // Screen flow: o1 → o2 → m1 (egg) → u1 → m1 (egg + ≥10km → e1) → m1 (hatched)
  const [screen, setScreen] = React.useState('o1');
  const [palette, setPalette] = React.useState(null); // [c1, c2, c3]
  const [hatched, setHatched] = React.useState(false);
  const [charName, setCharName] = React.useState('');
  const [gender] = React.useState('수컷'); // server-assigned 50/50 per the plan; locked here for the demo
  const [runs, setRuns] = React.useState([]);
  const [titles] = React.useState([]); // empty until the user actually meets a condition

  const totalKm = runs.reduce((a, r) => a + parseFloat(r.km || 0), 0);

  function onSocialLogin() { setScreen('o2'); }
  function onEggPick(p) { setPalette(p); setScreen('m1'); }
  function onUploadConfirm(fields) {
    // strip units, store as { km, pace, minutes, when }
    const km = parseFloat(String(fields.km).replace(/[^0-9.]/g, '')) || 0;
    const minutes = parseInt(String(fields.time).replace(/[^0-9]/g, '').slice(0, 2) || '0', 10) || 0;
    const pace = String(fields.pace).replace(/\s*\/km\s*$/, '');
    const newRun = {
      km: km.toFixed(1),
      pace,
      minutes,
      when: relativeWhen(new Date()),
    };
    const next = [newRun, ...runs];
    setRuns(next);
    // Hatch trigger: cumulative ≥ 10 km
    const nextTotal = next.reduce((a, r) => a + parseFloat(r.km), 0);
    if (!hatched && nextTotal >= 10) {
      setScreen('e1');
    } else {
      setScreen('m1');
    }
  }
  function onName(name) {
    setCharName(name);
    setHatched(true);
    setScreen('m1');
  }
  function onLogout() {
    setScreen('o1');
    setPalette(null);
    setHatched(false);
    setCharName('');
    setRuns([]);
  }

  function onNav(target) {
    if (target === 'm1' && screen !== 'o1' && screen !== 'o2') setScreen('m1');
    else if (target === 'u1') setScreen('u1');
    else if (target === 'p1') setScreen('p1');
  }

  const screenEl = (() => {
    if (screen === 'o1') return <ScreenO1 onLogin={onSocialLogin} />;
    if (screen === 'o2') return <ScreenO2 onPick={onEggPick} />;
    if (screen === 'u1') return <ScreenU1 onBack={() => setScreen('m1')} onConfirm={onUploadConfirm} />;
    if (screen === 'e1') return <ScreenE1Hatch palette={palette} onName={onName} />;
    if (screen === 'p1') return <ScreenP1
      palette={palette} hatched={hatched}
      charName={charName} gender={gender}
      totalKm={totalKm} runs={runs} titles={titles}
      onNav={onNav} onLogout={onLogout} />;
    return <ScreenM1
      palette={palette || ['#cccccc', '#999999', '#666666']}
      hatched={hatched}
      charName={charName} gender={gender}
      runs={runs} totalKm={totalKm}
      onNav={onNav}
      onUpload={() => setScreen('u1')}
    />;
  })();

  return (
    <React.Fragment>
      <PageMain>{screenEl}</PageMain>
      <ProtoBar screen={screen} setScreen={setScreen} hatched={hatched} palette={palette} />
    </React.Fragment>
  );
}

// Pretty "오늘 / 어제 / N일 전"
function relativeWhen(d) {
  const today = new Date();
  const diffDays = Math.floor((today - d) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return '오늘';
  if (diffDays === 1) return '어제';
  return `${diffDays}일 전`;
}

// Demo-only navigation strip — clearly labelled "prototype only".
function ProtoBar({ screen, setScreen, hatched, palette }) {
  const steps = [
    { id: 'o1', label: 'O1 랜딩' },
    { id: 'o2', label: 'O2 알 선택', disabled: false },
    { id: 'm1', label: 'M1 메인',   disabled: !palette },
    { id: 'u1', label: 'U1 업로드', disabled: !palette },
    { id: 'e1', label: 'E1 부화',   disabled: !palette || hatched },
    { id: 'p1', label: 'P1 프로필', disabled: !palette },
  ];
  return (
    <div className="proto-bar">
      <span className="proto-bar__title">Runmagotchi UI Kit</span>
      <span>prototype steps:</span>
      {steps.map(s => (
        <button key={s.id}
          className={`proto-bar__step ${screen === s.id ? 'is-current' : ''}`}
          onClick={() => setScreen(s.id)}
          disabled={s.disabled}>{s.label}</button>
      ))}
      <span className="proto-bar__spacer"></span>
      <span>state: {palette ? 'logged-in' : 'guest'} · {hatched ? 'hatched' : 'egg'}</span>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
