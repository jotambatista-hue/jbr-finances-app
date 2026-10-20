import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';

export interface ChartSeries {
  name: string;
  values: (number | null)[];
  /** Any CSS color, including var(--series-1). */
  color: string;
  type?: 'bar' | 'line';
  /** Bars with the same stack id are stacked (positives up, negatives down). */
  stack?: string;
  /** Bar color for negative values (diverging series). */
  negativeColor?: string;
}

interface Bar {
  d: string;
  color: string;
}

const PAD = { top: 12, right: 12, bottom: 28, left: 60 };
const BAR_GAP = 2;
const RADIUS = 4;

/** Round, human tick values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

/** Bar path with the corners rounded only at the data end (away from the baseline). */
function barPath(x: number, top: number, bottom: number, w: number, roundTop: boolean, roundBottom: boolean) {
  const r = Math.min(RADIUS, w / 2, (bottom - top) / 2);
  const t = roundTop ? r : 0;
  const b = roundBottom ? r : 0;
  return (
    `M${x},${top + t}` +
    (t ? `Q${x},${top} ${x + t},${top}` : '') +
    `H${x + w - t}` +
    (t ? `Q${x + w},${top} ${x + w},${top + t}` : '') +
    `V${bottom - b}` +
    (b ? `Q${x + w},${bottom} ${x + w - b},${bottom}` : '') +
    `H${x + b}` +
    (b ? `Q${x},${bottom} ${x},${bottom - b}` : '') +
    'Z'
  );
}

/**
 * Small SVG bar/line chart: one shared y-axis, grouped or stacked bars,
 * optional lines, a hover tooltip per x position, and a table for screen readers.
 */
@Component({
  selector: 'app-chart',
  host: { class: 'chart' },
  template: `
    @let l = layout();
    @if (series().length > 1) {
      <div class="chart-legend">
        @for (s of series(); track s.name) {
          <span class="legend-item">
            <span class="swatch" [class.swatch-line]="s.type === 'line'" [style.background]="s.color"></span>
            {{ s.name }}
          </span>
        }
      </div>
    }
    <div class="chart-wrap" (mouseleave)="hovered.set(null)">
      <svg
        [attr.viewBox]="'0 0 ' + l.width + ' ' + l.height"
        [attr.width]="l.width"
        [attr.height]="l.height"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        @for (t of l.ticks; track t) {
          <line class="chart-grid" [attr.x1]="l.plotL" [attr.x2]="l.plotR" [attr.y1]="l.y(t)" [attr.y2]="l.y(t)" />
          <text class="chart-tick" [attr.x]="l.plotL - 8" [attr.y]="l.y(t) + 4" text-anchor="end">{{ tickFormat()(t) }}</text>
        }
        @if (hovered(); as i) {
          <rect class="chart-band" [attr.x]="l.plotL + (i - 1) * l.band" [attr.y]="l.plotT" [attr.width]="l.band" [attr.height]="l.plotB - l.plotT" />
        }
        @for (b of l.bars; track $index) {
          <path [attr.d]="b.d" [style.fill]="b.color" />
        }
        @if (l.ticks[0] <= 0 && l.ticks[l.ticks.length - 1] >= 0) {
          <line class="chart-baseline" [attr.x1]="l.plotL" [attr.x2]="l.plotR" [attr.y1]="l.y(0)" [attr.y2]="l.y(0)" />
        }
        @for (ln of l.lines; track ln.name) {
          <path class="chart-line" [attr.d]="ln.d" [style.stroke]="ln.color" />
          @if (hovered(); as i) {
            @if (ln.points[i - 1]; as p) {
              <circle class="chart-dot" [attr.cx]="p[0]" [attr.cy]="p[1]" r="4" [style.fill]="ln.color" />
            }
          }
        }
        @for (x of l.xLabels; track x.i) {
          <text class="chart-tick" [attr.x]="x.x" [attr.y]="l.height - 8" text-anchor="middle">{{ x.text }}</text>
        }
        @for (label of labels(); track $index) {
          <rect
            class="chart-hit"
            [attr.x]="l.plotL + $index * l.band"
            [attr.y]="0"
            [attr.width]="l.band"
            [attr.height]="l.height"
            (mouseenter)="hovered.set($index + 1)"
          />
        }
      </svg>
      @if (hovered(); as i) {
        <div
          class="chart-tooltip"
          role="tooltip"
          [style.left.px]="l.plotL + (i - 0.5) * l.band"
          [class.flip]="i > labels().length / 2"
        >
          <strong>{{ (titles() ?? labels())[i - 1] }}</strong>
          @for (s of series(); track s.name) {
            @if (s.values[i - 1] !== null && s.values[i - 1] !== undefined) {
              <span class="tt-row">
                <span class="swatch" [class.swatch-line]="s.type === 'line'" [style.background]="colorFor(s, s.values[i - 1]!)"></span>
                <span class="tt-name">{{ s.name }}</span>
                <span class="tt-value">{{ format()(s.values[i - 1]!) }}</span>
              </span>
            }
          }
        </div>
      }
    </div>
    <div class="sr-only">
    <table>
      <caption>{{ ariaLabel() }}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          @for (s of series(); track s.name) {
            <th scope="col">{{ s.name }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (label of titles() ?? labels(); track $index; let row = $index) {
          <tr>
            <th scope="row">{{ label }}</th>
            @for (s of series(); track s.name) {
              <td>{{ s.values[row] == null ? '—' : format()(s.values[row]!) }}</td>
            }
          </tr>
        }
      </tbody>
    </table>
    </div>
  `,
})
export class Chart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();
  /** Full labels for the tooltip and table; defaults to `labels`. */
  readonly titles = input<string[]>();
  readonly height = input(240);
  readonly format = input<(v: number) => string>((v) => v.toLocaleString());
  readonly tickFormat = input<(v: number) => string>((v) => v.toLocaleString());
  readonly ariaLabel = input('Chart');
  /** Bars always start at zero; a line-only chart can zoom to its data range. */
  readonly includeZero = input(true);

  /** 1-based so 0 never reads as "nothing hovered" in @if. */
  protected readonly hovered = signal<number | null>(null);
  private readonly width = signal(640);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Fill the container's width; SSR renders at the default width.
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => this.width.set(Math.max(280, entry.contentRect.width)));
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected colorFor(s: ChartSeries, v: number) {
    return v < 0 && s.negativeColor ? s.negativeColor : s.color;
  }

  protected readonly layout = computed(() => {
    const width = this.width();
    const height = this.height();
    const labels = this.labels();
    const series = this.series();
    const n = Math.max(1, labels.length);
    const plotL = PAD.left;
    const plotR = width - PAD.right;
    const plotT = PAD.top;
    const plotB = height - PAD.bottom;

    // Bar groups: each stack id (or lone bar series) gets one slot per x position.
    const groups: { key: string; members: ChartSeries[] }[] = [];
    series.forEach((s, i) => {
      if (s.type === 'line') return;
      const key = s.stack ?? `__${i}`;
      const g = groups.find((x) => x.key === key);
      if (g) g.members.push(s);
      else groups.push({ key, members: [s] });
    });

    let min = this.includeZero() ? 0 : Infinity;
    let max = this.includeZero() ? 0 : -Infinity;
    for (let i = 0; i < n; i++) {
      for (const g of groups) {
        let pos = 0;
        let neg = 0;
        for (const s of g.members) {
          const v = s.values[i] ?? 0;
          if (v >= 0) pos += v;
          else neg += v;
        }
        max = Math.max(max, pos);
        min = Math.min(min, neg);
      }
      for (const s of series) {
        if (s.type !== 'line' || s.values[i] == null) continue;
        max = Math.max(max, s.values[i]!);
        min = Math.min(min, s.values[i]!);
      }
    }
    if (!Number.isFinite(min)) [min, max] = [0, 1];
    const ticks = niceTicks(min, max);
    const yMin = ticks[0];
    const yMax = ticks[ticks.length - 1];
    const y = (v: number) => plotB - ((v - yMin) / (yMax - yMin || 1)) * (plotB - plotT);
    const band = (plotR - plotL) / n;

    const G = Math.max(1, groups.length);
    const barW = Math.max(3, Math.min(30, (band * 0.7 - BAR_GAP * (G - 1)) / G));
    const groupWidth = G * barW + (G - 1) * BAR_GAP;
    const bars: Bar[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = plotL + i * band + (band - groupWidth) / 2;
      groups.forEach((g, gi) => {
        const x = x0 + gi * (barW + BAR_GAP);
        let pos = 0;
        let neg = 0;
        g.members.forEach((s, si) => {
          const v = s.values[i];
          if (v == null || v === 0) return;
          const from = v >= 0 ? pos : neg;
          const to = from + v;
          if (v >= 0) pos = to;
          else neg = to;
          // Outermost segment in its direction gets the rounded data end.
          const outer = !g.members.slice(si + 1).some((o) => (o.values[i] ?? 0) !== 0 && Math.sign(o.values[i]!) === Math.sign(v));
          let top = y(Math.max(from, to));
          let bottom = y(Math.min(from, to));
          // 2px surface gap where a segment sits on another one.
          if (from !== 0) {
            if (v > 0) bottom -= BAR_GAP;
            else top += BAR_GAP;
          }
          if (bottom - top < 0.5) return;
          bars.push({
            d: barPath(x, top, bottom, barW, outer && v > 0, outer && v < 0),
            color: this.colorFor(s, v),
          });
        });
      });
    }

    const lines = series
      .filter((s) => s.type === 'line')
      .map((s) => {
        const points = s.values.map((v, i) => (v == null ? null : ([plotL + (i + 0.5) * band, y(v)] as [number, number])));
        const d = points
          .map((p, i) => (p ? `${i === 0 || !points[i - 1] ? 'M' : 'L'}${p[0]},${p[1]}` : ''))
          .join('');
        return { name: s.name, color: s.color, d, points };
      });

    const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((plotR - plotL) / 54))));
    const xLabels = labels
      .map((text, i) => ({ i, text, x: plotL + (i + 0.5) * band }))
      .filter((l) => l.i % every === 0);

    return { width, height, plotL, plotR, plotT, plotB, ticks, y, band, bars, lines, xLabels };
  });
}
