import { BILL_LIMITS, CITY_OPTIONS, ROOF_TYPES, inr } from '../lib/localEstimate';

export default function SolarInputForm({ values, onChange, onSubmit, busy, valid }) {
  const { monthlyBill, location, roofType, sanctionedLoadKW } = values;

  return (
    <form
      className="card p-5 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit();
      }}
      noValidate
    >
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-medium">Your rooftop</h2>
        <span className="eyebrow">Input / 01</span>
      </div>

      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="bill" className="field-label !mb-0">
            Average monthly bill
          </label>
          <span className="font-mono text-sm">{'₹'} {inr(monthlyBill || 0)}</span>
        </div>
        <input
          type="range"
          min="500"
          max="50000"
          step="100"
          value={Math.min(Math.max(Number(monthlyBill) || 500, 500), 50000)}
          onChange={(e) => onChange({ monthlyBill: Number(e.target.value) })}
          className="w-full"
          aria-label="Monthly bill slider"
        />
        <input
          id="bill"
          type="number"
          inputMode="numeric"
          min={BILL_LIMITS.min}
          max={BILL_LIMITS.max}
          value={monthlyBill}
          onChange={(e) => onChange({ monthlyBill: e.target.value === '' ? '' : Number(e.target.value) })}
          className="field mt-2 font-mono"
        />
        {monthlyBill !== '' && (monthlyBill < BILL_LIMITS.min || monthlyBill > BILL_LIMITS.max) && (
          <p className="mt-1 text-xs text-solar">
            Enter a bill between {'₹'}{inr(BILL_LIMITS.min)} and {'₹'}{inr(BILL_LIMITS.max)}.
          </p>
        )}
      </div>

      <div className="mb-5">
        <label htmlFor="location" className="field-label">City, state</label>
        <input
          id="location"
          list="city-options"
          value={location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="e.g. Bhopal, MP"
          autoComplete="off"
          maxLength={60}
          className="field"
        />
        <datalist id="city-options">
          {CITY_OPTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="mb-5">
        <label htmlFor="roof" className="field-label">Roof type</label>
        <select
          id="roof"
          value={roofType}
          onChange={(e) => onChange({ roofType: e.target.value })}
          className="field"
        >
          {Object.keys(ROOF_TYPES).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <label htmlFor="load" className="field-label">
          Sanctioned load (kW) <span className="normal-case tracking-normal text-muted/70">optional</span>
        </label>
        <input
          id="load"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.5"
          value={sanctionedLoadKW}
          onChange={(e) => onChange({ sanctionedLoadKW: e.target.value })}
          placeholder="Printed on your bill"
          className="field font-mono"
        />
      </div>

      <button type="submit" className="btn-primary" disabled={!valid || busy}>
        {busy ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-canvas/40 border-t-canvas" aria-hidden="true" />
            Auditing your roof…
          </>
        ) : (
          'Generate solar audit'
        )}
      </button>
      <p className="mt-3 text-center text-xs text-muted">
        No names or addresses are collected. Inputs are processed in memory only.
      </p>
    </form>
  );
}
