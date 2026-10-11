export default function Header({ onOpenArchitecture }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/" className="flex items-center gap-3" aria-label="SolarPulse by Qashfin home">
          <img src="/logo.svg" alt="" className="h-9 w-9" />
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold tracking-tight">SolarPulse</div>
            <div className="eyebrow !text-[10px]">by Qashfin</div>
          </div>
        </a>
        <div className="flex items-center gap-3">
          <span className="eyebrow hidden sm:inline">BB-TOUR // STAGE-02</span>
          <button type="button" className="btn-ghost" onClick={onOpenArchitecture}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="8.5" y="14" width="7" height="7" rx="1" />
              <path d="M6.5 10v2.5h11V10M12 12.5V14" />
            </svg>
            AWS architecture
          </button>
        </div>
      </div>
    </header>
  );
}
