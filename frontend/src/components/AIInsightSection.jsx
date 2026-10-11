function Banner({ tone, title, children }) {
  const styles =
    tone === 'warn'
      ? 'border-solar/40 bg-solar-soft'
      : 'border-line bg-paper';
  return (
    <div className={`rounded-lg border p-4 ${styles}`} role="status">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Generating advisory">
      {[70, 90, 60, 80].map((w, i) => (
        <div key={i} className="space-y-2">
          <div className="skeleton h-2.5 w-24" />
          <div className="skeleton h-4" style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  );
}

function Item({ label, children }) {
  return (
    <div className="grid gap-1 border-t border-line py-3 first:border-t-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="field-label !mb-0 pt-0.5">{label}</dt>
      <dd className="text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

export default function AIInsightSection({ phase, advisory, metadata, stale, retryAfterSec, errorMessage, apiConfigured }) {
  let body;

  if (phase === 'evaluating') {
    body = <Skeleton />;
  } else if (phase === 'throttled') {
    body = (
      <Banner tone="warn" title="Rate-limit safeguard active">
        API Gateway and DynamoDB allow 15 audits per minute per client to protect the AI budget. Please
        retry in about {retryAfterSec || 60} seconds. Your live estimate above is still valid.
      </Banner>
    );
  } else if (phase === 'error') {
    body = (
      <Banner tone="warn" title="The audit could not be completed">
        {errorMessage || 'Something went wrong.'} Your live estimate above is still available.
      </Banner>
    );
  } else if (phase === 'audited' && advisory) {
    body = (
      <div className={stale ? 'opacity-60' : ''}>
        {stale && (
          <p className="mb-3 text-xs text-solar">Inputs changed since this audit. Run it again to refresh.</p>
        )}
        <dl>
          <Item label="System sizing">{advisory.systemSizingNote}</Item>
          <Item label="Capital expenditure">{advisory.capitalExpenditureEst}</Item>
          <Item label="Central subsidy">{advisory.centralSubsidyEligibility}</Item>
          <Item label="Payback">{advisory.paybackTimeframe}</Item>
          <Item label="Structural guidance">
            <ol className="space-y-2">
              {advisory.structuralGuidance.map((g, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-xs text-solar">{String(i + 1).padStart(2, '0')}</span>
                  <span>{g}</span>
                </li>
              ))}
            </ol>
          </Item>
        </dl>
      </div>
    );
  } else {
    body = (
      <Banner title="Run the audit for the full advisory">
        {apiConfigured
          ? 'The audit adds localized structural guidance, subsidy navigation and a payback range written by Amazon Bedrock.'
          : 'The audit service is not connected in this build, so only the live estimate is shown. Set VITE_API_BASE_URL to enable it.'}
      </Banner>
    );
  }

  return (
    <section className="card p-5 sm:p-6" aria-label="AI solar advisory">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="eyebrow">Advisory / 03</span>
          <h2 className="font-display text-xl font-medium">Engineering advisory</h2>
        </div>
        {phase === 'audited' && metadata && (
          <span
            className={`chip ${
              metadata.advisorySource === 'bedrock'
                ? 'border-forest/30 bg-forest-soft text-forest'
                : 'border-line bg-paper text-muted'
            }`}
          >
            {metadata.advisorySource === 'bedrock' ? 'Amazon Bedrock' : 'Rule engine'} · {metadata.latencyMs} ms
          </span>
        )}
      </div>
      {body}
    </section>
  );
}
