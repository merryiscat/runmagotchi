// chrome.jsx — Frame, GNB, Topbar shells used across screens

function GNB({ activeTab, onNav }) {
  return (
    <div className="gnb">
      <button className="gnb__logo" onClick={() => onNav('m1')}>Runmagotchi</button>
      <nav className="gnb__nav">
        <button
          className={activeTab === 'upload' ? 'active' : ''}
          onClick={() => onNav('u1')}
        >업로드</button>
        <button
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => onNav('p1')}
        >프로필</button>
      </nav>
    </div>
  );
}

function Topbar({ onBack, title, right = null }) {
  return (
    <div className="topbar">
      <button onClick={onBack}>← 돌아가기</button>
      <span className="topbar__title">{title}</span>
      <span style={{ width: 60 }}>{right}</span>
    </div>
  );
}

function Frame({ children, style }) {
  return (
    <div className="frame frame--web" style={{ minHeight: 'auto', ...style }}>
      {children}
    </div>
  );
}

function PageMain({ children }) {
  return (
    <div className="page">
      <main className="page__main">{children}</main>
    </div>
  );
}

Object.assign(window, { GNB, Topbar, Frame, PageMain });
