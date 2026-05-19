// stage.jsx — Stage, Egg, Character, Crack illustrations.
// Color comes ONLY from the per-character color_palette, applied via inline CSS vars.

function Egg({ palette }) {
  // palette is [c1, c2, c3]; egg uses c1 as the body, with a c2 hint band.
  const [c1, c2, c3] = palette || ['#e8d8c0', '#9a7b5c', '#3b2a1f'];
  return (
    <div className="egg-art" style={{ '--egg-color': c1 }}>
      {/* a subtle band hinting at c2 — kept minimal so the wireframe vibe holds */}
      <div style={{
        position: 'absolute', left: '8%', right: '8%', bottom: '24%',
        height: '12%', background: c2, opacity: 0.55,
        borderRadius: '50%', filter: 'blur(0.5px)'
      }} />
      <div style={{
        position: 'absolute', left: '24%', right: '24%', bottom: '12%',
        height: '6%', background: c3, opacity: 0.35,
        borderRadius: '50%'
      }} />
    </div>
  );
}

function EggCracked({ palette, level }) {
  // level: 1 / 2 / 3 — progressively heavier crack lines drawn as SVG over the egg.
  const cracks = {
    1: <path d="M52 18 L48 32 L56 38" stroke="#222" strokeWidth="1.5" fill="none" />,
    2: (
      <g stroke="#1a1a1a" strokeWidth="1.5" fill="none">
        <path d="M52 18 L48 32 L56 38 L50 50" />
        <path d="M40 28 L46 36" />
        <path d="M62 30 L58 40" />
      </g>
    ),
    3: (
      <g stroke="#0d0d0d" strokeWidth="1.8" fill="none">
        <path d="M52 14 L46 26 L56 34 L48 46 L58 56" />
        <path d="M36 24 L44 30 L40 40 L48 48" />
        <path d="M64 24 L60 34 L66 42 L60 52" />
        <path d="M30 36 L40 42" />
        <path d="M70 36 L60 42" />
      </g>
    ),
  };
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Egg palette={palette} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {cracks[level] || cracks[1]}
      </svg>
    </div>
  );
}

function Character({ palette, stage = 'baby' }) {
  // Simple abstract creature using the 3-color palette. Stage controls a modest size delta only —
  // real product replaces this with AI-generated art per stage.
  const [c1, c2, c3] = palette || ['#c8dde8', '#7aa3c1', '#2f4858'];
  const sizes = { baby: 60, child: 70, adult: 80 };
  const size = sizes[stage] || 72;
  return (
    <div style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      <div className="char-art" style={{
        '--char-c1': c1,
        '--char-c2': c2,
        '--char-c3': c3,
        width: `${size}%`,
      }}>
        <div className="belly" />
      </div>
    </div>
  );
}

// The stage component — left half of M1, contains the character or egg.
function Stage({ children, footer, label }) {
  return (
    <div className="stage">
      {label && <div className="stage__label">{label}</div>}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px var(--s-5)',
      }}>
        <div style={{ width: 220, maxWidth: '70%' }}>
          {children}
        </div>
      </div>
      {footer && <div className="stage__footer">{footer}</div>}
    </div>
  );
}

Object.assign(window, { Egg, EggCracked, Character, Stage });
