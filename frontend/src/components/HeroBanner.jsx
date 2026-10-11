import tourBadge from '../assets/tour-badge.svg';

const POINTS = [
  ['01', 'Capacity and footprint', 'kW to install and the roof area it needs.'],
  ['02', 'Savings and payback', 'Monthly bill reduction, subsidy and years to break even.'],
  ['03', 'Carbon offset', 'Annual CO₂ avoided versus coal-heavy grid power.'],
];

export default function HeroBanner() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:py-16">
        <div className="animate-fadeUp">
          <div className="mb-5 flex items-center gap-3">
            <img src={tourBadge} alt="Bharat Builds Tour, Track 03" className="h-14 w-14" />
            <span className="eyebrow">03 / WASTE AND ENERGY</span>
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl">
            Is your roof ready for solar?
            <span className="block text-muted">Find out from one power bill.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted">
            Enter your monthly bill, city and roof type. SolarPulse sizes a rooftop system, estimates
            savings under the PM Surya Ghar scheme, and writes an engineering-style advisory with
            Amazon Bedrock.
          </p>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {POINTS.map(([n, title, body]) => (
              <li key={n} className="flex gap-4 py-3">
                <span className="font-mono text-xs text-solar">{n}</span>
                <p className="text-sm">
                  <span className="font-medium">{title}.</span>{' '}
                  <span className="text-muted">{body}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>
        <img
          src="/solar-hero-badge.svg"
          alt="Illustration of a rooftop solar array under the sun with a grid meter"
          className="w-full max-w-md justify-self-center md:justify-self-end"
        />
      </div>
    </section>
  );
}
