import { SOURCES, BHF_HELPLINE, GENERAL_DISCLAIMER } from '../data/recoveryPlan';

export default function SourcesFooter() {
  return (
    <footer className="text-sm text-recovery-ink/60 space-y-4 pb-8">
      <p className="text-recovery-ink/80">{GENERAL_DISCLAIMER}</p>
      <p>
        Feeling low or frustrated some days is common after a heart attack — it's worth mentioning
        to your GP or rehab team if it isn't lifting, not something to just push through.
      </p>
      <div>
        <p className="font-semibold text-recovery-ink/70 mb-1">Sources</p>
        <ul className="space-y-1">
          {SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2">
          BHF cardiac nurse helpline: <a href="tel:08088021234" className="underline">{BHF_HELPLINE}</a> (free, Mon–Fri 9am–5pm)
        </p>
      </div>
    </footer>
  );
}
