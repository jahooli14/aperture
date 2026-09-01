import { BANDS, DAYS, bucketByPeakTime, describePeak } from '../lib/peakTimes'

/**
 * When the two of you tend to write. A sequential heatmap — one hue, light
 * to dark, magnitude only — built from the app's own accent colour rather
 * than a separate chart palette, so it reads as part of the same interface
 * rather than a bolted-on widget.
 *
 * No number sits inside every cell (that's the busy way to do this); the
 * plain-English caption is the actual takeaway, and the grid is what makes
 * it credible at a glance.
 */
export function PeakTimes({ timestamps }: { timestamps: string[] }) {
  const grid = bucketByPeakTime(timestamps)
  const max = Math.max(1, ...grid.flat())
  const caption = describePeak(grid)

  if (timestamps.length < 6) return null

  return (
    <section>
      <h3 className="label">When you write</h3>
      <div className="peak-grid">
        <div className="peak-grid-row peak-grid-header">
          <span />
          {BANDS.map((band) => (
            <span key={band} className="peak-band-label">
              {band}
            </span>
          ))}
        </div>
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="peak-grid-row">
            <span className="peak-day-label">{day}</span>
            {BANDS.map((band, bandIndex) => {
              const count = grid[dayIndex][bandIndex]
              const strength = count === 0 ? 0 : 0.22 + 0.78 * (count / max)
              return (
                <span
                  key={band}
                  className="peak-cell"
                  style={{
                    background:
                      count === 0
                        ? 'rgb(var(--sunk))'
                        : `color-mix(in oklch, rgb(var(--accent)) ${Math.round(strength * 100)}%, rgb(var(--sunk)))`,
                  }}
                  tabIndex={count > 0 ? 0 : -1}
                  title={`${day} ${band.toLowerCase()}: ${count} ${count === 1 ? 'line' : 'lines'}`}
                  aria-label={`${day} ${band}: ${count} ${count === 1 ? 'line' : 'lines'}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="peak-legend">
        <span>Fewer</span>
        <span className="peak-legend-swatch" style={{ background: 'rgb(var(--sunk))' }} />
        <span className="peak-legend-swatch" style={{ background: 'color-mix(in oklch, rgb(var(--accent)) 40%, rgb(var(--sunk)))' }} />
        <span className="peak-legend-swatch" style={{ background: 'color-mix(in oklch, rgb(var(--accent)) 70%, rgb(var(--sunk)))' }} />
        <span className="peak-legend-swatch" style={{ background: 'rgb(var(--accent))' }} />
        <span>More</span>
      </div>
      {caption && <p className="mt-2 text-sm text-muted">{caption}</p>}
    </section>
  )
}
