export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="" className="h-7 w-7" />
            <div>
              <p className="font-display text-base font-medium">SolarPulse by Qashfin</p>
              <p className="eyebrow !text-[10px]">Bharat Builds Tour · Track 03</p>
            </div>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            Privacy: no names, phone numbers or street addresses are collected. Bill, city and roof type are
            processed in memory only. Hashed IPs are kept for up to 60 minutes to prevent abuse.
          </p>
        </div>
        <p className="mt-6 text-xs text-muted">
          Estimates are indicative, based on an assumed tariff of {'₹'}7.5/kWh and typical city yields. Get a site
          survey from an empanelled vendor before purchase. Effective October 11, 2026.
        </p>
      </div>
    </footer>
  );
}
