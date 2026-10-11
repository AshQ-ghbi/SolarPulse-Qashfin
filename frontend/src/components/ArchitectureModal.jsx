import { useEffect, useRef } from 'react';
import { API_HOST } from '../config/apiConfig';

const STEPS = [
  { name: 'AWS Amplify Hosting', detail: 'Serves this React app from a global CDN with Git-based CI/CD.' },
  { name: 'Amazon API Gateway', detail: 'HTTP API at POST /api/audit-solar with strict CORS and burst throttling.' },
  { name: 'AWS Lambda', detail: 'Node.js 24 validates input and computes the deterministic solar metrics.' },
  { name: 'Amazon DynamoDB', detail: 'Hashed-IP counter with TTL enforces 15 audits per minute per client.' },
  { name: 'Amazon Bedrock', detail: 'Claude Haiku 5.5 at temperature 0.2 writes the structured advisory.' },
];

export default function ArchitectureModal({ open, onClose, metadata, phase }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const audited = phase === 'audited' && metadata;
  const usedBedrock = audited && metadata.advisorySource === 'bedrock';

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="AWS architecture">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md animate-slideIn overflow-y-auto bg-canvas p-6 shadow-drawer">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <span className="eyebrow">Verification</span>
            <h2 className="font-display text-2xl font-medium">Serverless architecture</h2>
          </div>
          <button ref={closeRef} type="button" className="btn-ghost" onClick={onClose} aria-label="Close architecture panel">
            Close
          </button>
        </div>

        <ol className="relative space-y-0">
          {STEPS.map((s, i) => {
            const live =
              audited && (i < 4 || (i === 4 && usedBedrock));
            return (
              <li key={s.name} className="relative flex gap-4 pb-6 last:pb-0">
                {i < STEPS.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-line" aria-hidden="true" />}
                <span
                  className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs ${
                    live ? 'border-forest bg-forest-soft text-forest' : 'border-line bg-white text-muted'
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="card mt-8 p-4">
          <span className="field-label">Last audit</span>
          {audited ? (
            <dl className="font-mono text-xs">
              <div className="flex justify-between py-1"><dt className="text-muted">Engine</dt><dd>{metadata.engine}</dd></div>
              <div className="flex justify-between py-1"><dt className="text-muted">Latency</dt><dd>{metadata.latencyMs} ms</dd></div>
              <div className="flex justify-between py-1"><dt className="text-muted">Advisory source</dt><dd>{metadata.advisorySource}</dd></div>
              <div className="flex justify-between py-1"><dt className="text-muted">API host</dt><dd className="truncate pl-4">{API_HOST}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-muted">Run an audit to see live latency and engine details from the deployed stack.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
