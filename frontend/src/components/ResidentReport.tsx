type Row = { topic: string; mentions: number; negative: number; recurring: boolean }

// Illustrative data for a fictional building. Real reports come from
// POST /api/apartment-intelligence/insights.
const ROWS: Row[] = [
  { topic: 'Maintenance', mentions: 14, negative: 9, recurring: true },
  { topic: 'Pests', mentions: 11, negative: 7, recurring: true },
  { topic: 'Internet', mentions: 9, negative: 1, recurring: false },
  { topic: 'Safety', mentions: 8, negative: 3, recurring: false },
  { topic: 'Noise', mentions: 6, negative: 2, recurring: false },
]

export function ResidentReport() {
  return (
    <figure className="rounded-[28px] border border-ink/10 bg-white/70 p-6 sm:p-8">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="font-display text-2xl font-semibold">Adams Court</span>
        <span className="text-sm text-ink-soft">Sample report, fictional building</span>
      </figcaption>

      <dl className="mt-5 grid grid-cols-3 gap-4 border-y border-ink/10 py-4 text-sm">
        <div>
          <dt className="text-ink-soft">Reviews</dt>
          <dd className="font-display text-3xl font-semibold tabular-nums">23</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Verified residents</dt>
          <dd className="font-display text-3xl font-semibold tabular-nums">15</dd>
        </div>
        <div>
          <dt className="text-ink-soft">Period</dt>
          <dd className="mt-1.5 font-semibold">Aug 2025 to Oct 2026</dd>
        </div>
      </dl>

      <table className="mt-4 w-full text-sm">
        <caption className="sr-only">What residents talk about</caption>
        <thead className="text-left text-ink-soft">
          <tr>
            <th className="py-2 font-normal">Topic</th>
            <th className="py-2 text-right font-normal">Complaints</th>
            <th className="w-2/5 py-2 pl-4 font-normal">
              <span className="sr-only">Share negative</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.topic} className="border-t border-ink/5">
              <td className="py-2.5 font-semibold">
                {r.topic}
                {r.recurring && (
                  <span className="ml-2 rounded-full bg-alert/10 px-2 py-0.5 text-xs font-semibold text-alert">
                    Recurring
                  </span>
                )}
              </td>
              <td className="py-2.5 text-right tabular-nums text-ink-soft">
                {r.negative} of {r.mentions}
              </td>
              <td className="py-2.5 pl-4">
                <span className="block h-1.5 rounded-full bg-petal-deep">
                  <span
                    className={`block h-full rounded-full ${r.recurring ? 'bg-alert' : 'bg-jacaranda'}`}
                    style={{ width: `${(r.negative / r.mentions) * 100}%` }}
                  />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 rounded-2xl bg-petal p-4">
        <p className="font-semibold">Is there a roach problem?</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
          Likely, in some units. 7 of the 11 residents who mentioned pests reported cockroaches,
          5 of them verified, mostly in ground-floor kitchens between March and September 2026.
          Two reviewers on upper floors reported no issues.
        </p>
      </div>
    </figure>
  )
}
