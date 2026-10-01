import React, { useState } from 'react';

export interface ChartDataPoint {
  date: string;
  label: string;
  ratio: number; // 0.0 to 1.0
  completedCount: number;
  scheduledCount: number;
}

export interface ConsistencyChartProps {
  dataPoints: ChartDataPoint[];
  averageRatio: number;
  title?: string;
  subtitle?: string;
}

export const ConsistencyChart: React.FC<ConsistencyChartProps> = ({
  dataPoints,
  averageRatio,
  title = 'Tren Keberhasilan Harian',
  subtitle = 'Fluktuasi konsistensi penyelesaian ritual dalam periode yang dipilih'
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const width = 600;
  const height = 220;
  const padLeft = 35;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const pointsCount = dataPoints.length;

  const getX = (idx: number) => {
    if (pointsCount <= 1) return padLeft + chartW / 2;
    return padLeft + (idx / (pointsCount - 1)) * chartW;
  };

  const getY = (ratio: number) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    return padTop + chartH - clamped * chartH;
  };

  // Generate SVG path for line and area
  let linePath = '';
  let areaPath = '';

  if (pointsCount > 0) {
    const coords = dataPoints.map((pt, idx) => ({
      x: getX(idx),
      y: getY(pt.ratio)
    }));

    linePath = coords.reduce(
      (acc, curr, idx) => (idx === 0 ? `M ${curr.x},${curr.y}` : `${acc} L ${curr.x},${curr.y}`),
      ''
    );

    const firstX = coords[0]?.x ?? padLeft;
    const lastX = coords[coords.length - 1]?.x ?? (padLeft + chartW);
    const bottomY = padTop + chartH;

    areaPath = `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  }

  const avgY = getY(averageRatio);
  const avgPercentStr = `${Math.round(averageRatio * 100)}%`;

  // Filter X-axis labels to avoid crowding (at most 6 labels)
  const step = Math.max(1, Math.floor(pointsCount / 5));
  const visibleLabelIndices = new Set<number>();
  for (let i = 0; i < pointsCount; i += step) {
    visibleLabelIndices.add(i);
  }
  if (pointsCount > 0) {
    visibleLabelIndices.add(pointsCount - 1);
  }

  const activePoint = hoveredIndex !== null ? dataPoints[hoveredIndex] : null;

  return (
    <div className="bg-white dark:bg-slate-800 p-4 md:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600 dark:bg-teal-400 inline-block" />
            <span className="text-slate-700 dark:text-slate-300 font-medium">Realisasi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-400 dark:bg-slate-500 border-b border-dashed inline-block" />
            <span className="text-slate-500 dark:text-slate-400">Rata-rata ({avgPercentStr})</span>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full h-56 pt-2 select-none">
        {pointsCount === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
            Tidak ada data untuk rentang waktu ini.
          </div>
        ) : (
          <svg
            className="w-full h-full overflow-visible"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            aria-label="Grafik Tren Rasio Keberhasilan"
          >
            <defs>
              <linearGradient id="consistencyAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0D9488" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((level) => {
              const y = getY(level);
              return (
                <g key={level}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={width - padRight}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-100 dark:text-slate-700/60"
                    strokeWidth="1"
                  />
                  <text
                    x={padLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    className="text-[10px] fill-slate-400 dark:fill-slate-500 font-mono"
                  >
                    {Math.round(level * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Average Benchmark Dashed Line */}
            <line
              x1={padLeft}
              y1={avgY}
              x2={width - padRight}
              y2={avgY}
              stroke="#94A3B8"
              strokeDasharray="4 4"
              strokeWidth="1.5"
            />

            {/* Area Fill */}
            {areaPath && (
              <path d={areaPath} fill="url(#consistencyAreaGrad)" />
            )}

            {/* Main Trend Line */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#0D9488"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Data Point Circles */}
            {dataPoints.map((pt, idx) => {
              const cx = getX(idx);
              const cy = getY(pt.ratio);
              const isHovered = hoveredIndex === idx;

              return (
                <g key={pt.date}>
                  {/* Invisible larger hit target */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={12}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(idx)}
                    onBlur={() => setHoveredIndex(null)}
                    tabIndex={0}
                    aria-label={`${pt.label}: ${Math.round(pt.ratio * 100)}%`}
                  />
                  {/* Visible point circle */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : pointsCount <= 14 ? 4 : 2.5}
                    fill={isHovered ? '#0D9488' : '#ffffff'}
                    stroke="#0D9488"
                    strokeWidth={isHovered ? 2.5 : 2}
                    className="transition-all duration-150 pointer-events-none"
                  />
                </g>
              );
            })}

            {/* X Axis Labels */}
            {dataPoints.map((pt, idx) => {
              if (!visibleLabelIndices.has(idx)) return null;
              const x = getX(idx);
              const y = height - 8;
              return (
                <text
                  key={pt.date}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-500 dark:fill-slate-400 font-sans"
                >
                  {pt.label}
                </text>
              );
            })}
          </svg>
        )}

        {/* Hover Tooltip Overlay */}
        {activePoint && hoveredIndex !== null && (
          <div
            className="absolute pointer-events-none z-20 px-2.5 py-1.5 rounded-lg bg-slate-900/95 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs shadow-lg transform -translate-x-1/2 -translate-y-full mb-2 whitespace-nowrap transition-all"
            style={{
              left: `${(getX(hoveredIndex) / width) * 100}%`,
              top: `${(getY(activePoint.ratio) / height) * 100}%`
            }}
          >
            <div className="font-semibold">{activePoint.date}</div>
            <div className="text-[11px] opacity-90">
              {Math.round(activePoint.ratio * 100)}% ({activePoint.completedCount}/{activePoint.scheduledCount} selesai)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
