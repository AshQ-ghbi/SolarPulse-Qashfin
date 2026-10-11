import { inr } from '../lib/localEstimate';

const TONES = {
  slate: { bar: 'bg-slate-tech', text: 'text-slate-tech', soft: 'bg-slate-soft' },
  solar: { bar: 'bg-solar', text: 'text-solar', soft: 'bg-solar-soft' },
  forest: { bar: 'bg-forest', text: 'text-forest', soft: 'bg-forest-soft' },
};

function buildCards(m) {
  return [
    { code: '01', label: 'Recommended capacity', value: m.recommendedCapacityKW, unit: 'kW', tone: 'slate' },
    { code: '02', label: 'Roof area required', value: inr(m.requiredRoofAreaSqFt), unit: 'sq ft', tone: 'slate' },
    { code: '03', label: 'Annual generation', value: inr(m.estimatedAnnualUnitsKWh), unit: 'kWh', tone: 'solar' },
    { code: '04', label: 'Annual CO₂ offset', value: inr(m.annualCarbonOffsetKg), unit: 'kg', tone: 'forest' },
    { code: '05', label: 'Monthly savings', value: `₹${inr(m.estimatedMonthlySavingsInr)}`, unit: '/ month', tone: 'solar' },
  ];
}

function SkeletonCard() {
  return (
    <div className="card p-4">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton mt-5 h-8 w-28" />
      <div className="skeleton mt-3 h-2.5 w-16" />
    </div>
  );
}

function Row({ label, value, strong, tone }) {
  return (
    <tr className="border-t border-line first:border-t-0">
      <th scope="row" className="py-2.5 pr-4 text-left text-sm font-normal text-muted">{label}</th>
      <td className={`py-2.5 text-right font-mono text-sm ${strong ? 'font-medium' : ''} ${tone || ''}`}>{value}</td>
    </tr>
  );
}

export default function MetricCards({ metrics, financials, mode }) {
  const loading = mode === 'evaluating';

  if (!metrics) {
    return (
      <div className="card flex min-h-[220px] items-center justify-center p-8 text-center">
        <p className="max-w-sm text-sm text-muted">
          Enter a valid bill and city to see your live system estimate here.
        </p>
      </div>
    );
  }

  const cards = buildCards(metrics);
  const netLow = financials.costLowInr - financials.subsidyInr;
  const netHigh = financials.costHighInr - financials.subsidyInr;

  return (
    <section aria-label="Solar metrics">
      <div className="mb-3 flex items-center justify-between">
        <span className="eyebrow">Output / 02</span>
        <span
          className={`chip ${
            mode === 'audited'
              ? 'border-forest/30 bg-forest-soft text-forest'
              : 'border-line bg-white text-muted'
          }`}
        >
          {mode === 'audited' ? 'Audited by Lambda' : loading ? 'Auditing' : 'Live estimate'}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? cards.map((c) => <SkeletonCard key={c.code} />)
          : cards.map((c, i) => {
              const t = TONES[c.tone];
              return (
                <div key={c.code} className="card animate-fadeUp overflow-hidden" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className={`h-1 ${t.bar}`} />
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="field-label !mb-0">{c.label}</span>
                      <span className="font-mono text-[10px] text-muted/70">{c.code}</span>
                    </div>
                    <div className={`mt-4 font-display text-3xl font-medium tracking-tight ${t.text}`}>
                      {c.value}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-muted">{c.unit}</div>
                  </div>
                </div>
              );
            })}

        <div className="card p-4 sm:col-span-2 xl:col-span-1">
          {loading ? (
            <>
              <div className="skeleton h-3 w-28" />
              <div className="skeleton mt-4 h-24 w-full" />
            </>
          ) : (
            <>
              <span className="field-label">Financial statement</span>
              <table className="w-full">
                <tbody>
                  <Row label="Capital cost" value={`₹${inr(financials.costLowInr)} – ${inr(financials.costHighInr)}`} />
                  <Row label="PM Surya Ghar subsidy" value={`− ₹${inr(financials.subsidyInr)}`} tone="text-forest" />
                  <Row label="Net investment" value={`₹${inr(netLow)} – ${inr(netHigh)}`} strong />
                  <Row label="Payback" value={`${financials.paybackYearsMin} – ${financials.paybackYearsMax} yrs`} strong tone="text-solar" />
                  <Row label="Bill offset" value={`${financials.offsetPercent}%`} />
                  <Row label="Trees equivalent" value={`~${inr(financials.equivalentTrees)}`} />
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
      {financials.cappedBySanctionedLoad && !loading && (
        <p className="mt-3 text-xs text-muted">
          System size is capped at your sanctioned load, so it offsets less than 80% of your bill.
        </p>
      )}
    </section>
  );
}
