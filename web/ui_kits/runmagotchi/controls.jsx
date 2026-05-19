// controls.jsx — atomic form/control components

function Button({ children, variant = 'outline', size = 'md', full, disabled, onClick, type, style }) {
  const cls = [
    'btn',
    variant === 'primary' && 'btn--primary',
    full && 'btn--full',
    size === 'lg' && 'btn--lg',
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={disabled} onClick={onClick} type={type} style={style}>{children}</button>
  );
}

function SocialButton({ provider, onClick }) {
  // Letter placeholders per the wireframe — Google/Kakao/Naver brand marks are pending.
  const labels = { google: 'Google로 시작하기', kakao: '카카오로 시작하기', naver: '네이버로 시작하기' };
  const letters = { google: 'G', kakao: 'K', naver: 'N' };
  return (
    <button className="btn--social" onClick={onClick}>
      <span className="icon-ph">{letters[provider]}</span>
      {labels[provider]}
    </button>
  );
}

function Input({ value, onChange, placeholder, maxLength, type = 'text' }) {
  return (
    <input
      className="input"
      type={type}
      value={value || ''}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
    />
  );
}

function PeriodSelect({ value, onChange, options }) {
  return (
    <select className="period-select" value={value} onChange={e => onChange?.(e.target.value)}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button className={`toggle ${on ? 'toggle--on' : ''}`}
      onClick={() => onChange?.(!on)} aria-pressed={on} />
  );
}

function Field({ label, value, editable, onChange }) {
  return (
    <div className="field">
      <div className="field__label">{label}</div>
      <div
        className="field__value"
        contentEditable={editable || false}
        suppressContentEditableWarning
        onBlur={editable && onChange ? e => onChange(e.currentTarget.textContent) : undefined}
      >{value}</div>
    </div>
  );
}

function Token({ children }) {
  return <span className="token">{children}</span>;
}

Object.assign(window, { Button, SocialButton, Input, PeriodSelect, Toggle, Field, Token });
