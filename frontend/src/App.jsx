import { useCallback, useMemo, useState } from 'react';
import Header from './components/Header.jsx';
import HeroBanner from './components/HeroBanner.jsx';
import SolarInputForm from './components/SolarInputForm.jsx';
import MetricCards from './components/MetricCards.jsx';
import AIInsightSection from './components/AIInsightSection.jsx';
import ArchitectureModal from './components/ArchitectureModal.jsx';
import Footer from './components/Footer.jsx';
import { API_CONFIGURED, requestAudit } from './config/apiConfig.js';
import { estimateLocally } from './lib/localEstimate.js';

// Phases follow the app-flow state machine:
// idle (0) -> local (1) -> evaluating (2) -> audited (3) | throttled / error (4)
const INITIAL_FORM = {
  monthlyBill: 4500,
  location: 'Bhopal, MP',
  roofType: 'Concrete Flat',
  sanctionedLoadKW: 5,
};

const keyOf = (f) => JSON.stringify([Number(f.monthlyBill), f.location.trim(), f.roofType, Number(f.sanctionedLoadKW) || null]);

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null); // { data, key }
  const [retryAfterSec, setRetryAfterSec] = useState(60);
  const [errorMessage, setErrorMessage] = useState('');
  const [archOpen, setArchOpen] = useState(false);

  const local = useMemo(() => estimateLocally(form), [form]);
  const valid = Boolean(local);

  const handleChange = useCallback((patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setPhase((p) => (p === 'evaluating' ? p : p === 'idle' ? 'local' : p));
  }, []);

  const runAudit = useCallback(async () => {
    if (!valid) return;
    if (!API_CONFIGURED) {
      setErrorMessage('The audit service is not connected in this build (VITE_API_BASE_URL is not set).');
      setPhase('error');
      return;
    }
    setPhase('evaluating');
    setErrorMessage('');
    const key = keyOf(form);
    try {
      const payload = {
        monthlyBill: Number(form.monthlyBill),
        currency: 'INR',
        location: form.location.trim(),
        roofType: form.roofType,
      };
      if (Number(form.sanctionedLoadKW) > 0) payload.sanctionedLoadKW = Number(form.sanctionedLoadKW);

      const { status, data } = await requestAudit(payload);
      if (status === 429) {
        setRetryAfterSec((data && data.retryAfterSec) || 60);
        setPhase('throttled');
      } else if (status === 200 && data && data.success) {
        setResult({ data, key });
        setPhase('audited');
      } else {
        const detail = data && (data.details ? data.details.join(' ') : data.message);
        setErrorMessage(detail || `The service returned an unexpected response (${status}).`);
        setPhase('error');
      }
    } catch (err) {
      setErrorMessage(err.message);
      setPhase('error');
    }
  }, [form, valid]);

  const audited = phase === 'audited' && result;
  const stale = Boolean(audited && result.key !== keyOf(form));
  const showAudited = audited && !stale;

  // Display the authoritative audited numbers when fresh, otherwise the live estimate.
  const metrics = showAudited ? result.data.deterministicMetrics : local && local.deterministicMetrics;
  const financials = showAudited
    ? { ...local?.financials, ...result.data.financials }
    : local && local.financials;
  const metricsMode = phase === 'evaluating' ? 'evaluating' : showAudited ? 'audited' : 'local';

  return (
    <div className="min-h-screen">
      <Header onOpenArchitecture={() => setArchOpen(true)} />
      <HeroBanner />

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[360px_1fr]">
        <div className="lg:sticky lg:top-20 lg:self-start">
          <SolarInputForm
            values={form}
            onChange={handleChange}
            onSubmit={runAudit}
            busy={phase === 'evaluating'}
            valid={valid}
          />
        </div>
        <div className="space-y-6">
          <MetricCards metrics={metrics} financials={financials} mode={metricsMode} />
          <AIInsightSection
            phase={phase}
            advisory={result && result.data.strategicAdvisory}
            metadata={result && result.data.metadata}
            stale={stale}
            retryAfterSec={retryAfterSec}
            errorMessage={errorMessage}
            apiConfigured={API_CONFIGURED}
          />
        </div>
      </main>

      <Footer />
      <ArchitectureModal
        open={archOpen}
        onClose={() => setArchOpen(false)}
        metadata={result && result.data.metadata}
        phase={phase}
      />
    </div>
  );
}
