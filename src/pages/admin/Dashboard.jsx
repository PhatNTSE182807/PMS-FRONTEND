import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { authService } from '../../services/authService';
import {
  reportService,
  REPORT_LOTS,
  VEHICLE_TYPES,
  PAYMENT_METHODS,
  RANGE_OPTIONS,
  GROUP_OPTIONS,
  DEFAULT_FILTERS,
} from '../../services/reportService';
import './AccountManagement.css';
import './Dashboard.css';

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

// Axis ticks: 1500000 -> "1.5M"
const compactVnd = (value) => (value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : `${Math.round(value / 1000)}K`);

/** Animate a number towards `target`, starting from whatever is currently shown (skipped for reduced motion). */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (target == null) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      latest.current = target;
      setValue(target);
      return undefined;
    }
    const from = latest.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const next = from + (target - from) * (1 - Math.pow(1 - progress, 3)); // ease-out cubic
      latest.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

const icons = {
  vehicles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16" />
      <rect x="3" y="16" width="18" height="4" rx="1.5" />
      <circle cx="7.5" cy="18" r="0.6" fill="currentColor" />
      <circle cx="16.5" cy="18" r="0.6" fill="currentColor" />
      <path d="M8 4h8" />
    </svg>
  ),
  revenue: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v.01M18 14.5v.01" />
    </svg>
  ),
  occupancy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 18l4-5" />
      <circle cx="12" cy="18" r="1" fill="currentColor" />
    </svg>
  ),
};

/** Change vs previous period; renders nothing when there is no baseline. */
function Trend({ pct }) {
  if (pct == null) return null;
  const kind = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '•';
  return (
    <span className={`db-trend db-trend--${kind}`}>
      {arrow} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

function StatCard({ id, variant, label, icon, value, format, unit, hint, trendPct, progress }) {
  const animated = useCountUp(value);
  return (
    <article className={`db-card ${variant ? `db-card--${variant}` : ''}`} id={id}>
      <div className="db-card__top">
        <span className="db-card__label">{label}</span>
        <span className="db-card__icon">{icon}</span>
      </div>
      <div className="db-card__value">
        {format(animated)}
        {unit && <span className="db-card__unit">{unit}</span>}
      </div>
      <div className="db-card__foot">
        <Trend pct={trendPct} />
        <span className="db-card__hint">{hint}</span>
      </div>
      {progress != null && (
        <div className="db-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
          <div className="db-progress__bar" style={{ width: `${progress}%` }} />
        </div>
      )}
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="db-card db-card--skeleton" aria-hidden="true">
      <div className="db-skeleton db-skeleton--label" />
      <div className="db-skeleton db-skeleton--value" />
      <div className="db-skeleton db-skeleton--hint" />
    </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="db-tooltip">
      <div className="db-tooltip__date">{point.date} · {point.fullDate}</div>
      <div className="db-tooltip__revenue">{vnd.format(point.revenue)}</div>
      <div className="db-tooltip__vehicles">{integer.format(point.vehicles)} vehicles</div>
    </div>
  );
}

function RevenueChart({ data, type }) {
  const common = { data, margin: { top: 10, right: 12, left: 0, bottom: 0 } };
  const shared = (
    <>
      <CartesianGrid stroke="rgba(0, 229, 255, 0.08)" strokeDasharray="3 5" vertical={false} />
      <XAxis dataKey="date" stroke="rgba(0, 229, 255, 0.18)" tickLine={false} minTickGap={12} />
      <YAxis tickFormatter={compactVnd} width={48} axisLine={false} tickLine={false} />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0, 242, 254, 0.07)', stroke: 'rgba(0, 242, 254, 0.3)' }} />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === 'bar' ? (
        <BarChart {...common}>
          <defs>
            <linearGradient id="db-bar-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00f2fe" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#0077b6" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          {shared}
          <Bar dataKey="revenue" fill="url(#db-bar-gradient)" radius={[8, 8, 0, 0]} maxBarSize={56} animationDuration={700} />
        </BarChart>
      ) : (
        <LineChart {...common}>
          {shared}
          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#00f2fe"
            strokeWidth={3}
            dot={data.length > 31 ? false : { r: 4, fill: '#060913', stroke: '#00f2fe', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#00f2fe', stroke: '#ffffff', strokeWidth: 2 }}
            animationDuration={700}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

function FilterSelect({ id, label, value, onChange, children }) {
  return (
    <div className="db-filter">
      <label htmlFor={id} className="db-filter__label">{label}</label>
      <select id={id} className="cyber-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

/** List of horizontal share bars (vehicle type / payment method). */
function ShareBars({ rows, amber = false }) {
  return (
    <ul className="db-bars">
      {rows.map((row) => (
        <li key={row.key} className={amber ? 'db-bars__row--amber' : ''}>
          <div className="db-bars__row-top">
            <span className="db-bars__name">{row.key}</span>
            <span className="db-bars__val">{vnd.format(row.revenue)} · {row.sharePct.toFixed(1)}%</span>
          </div>
          <div className="db-progress" role="progressbar" aria-valuenow={row.sharePct} aria-valuemin={0} aria-valuemax={100} aria-label={`${row.key} share`}>
            <div className="db-progress__bar" style={{ width: `${row.sharePct}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Revenue & performance dashboard (F1.12) for Web Admin - FR-RPT-01 / FR-RPT-02 / UC-08.
 * Filters (period, group by day/week/month, lot, vehicle type, payment method) -> KPI cards ->
 * revenue chart -> breakdown by lot (with occupancy), vehicle type and payment method.
 * Data is MOCK (reportService) until the Backend exposes report endpoints.
 *
 * @param {{ currentUserRole?: string }} props - falls back to the role stored in the session.
 */
export default function Dashboard({ currentUserRole }) {
  const role = currentUserRole ?? authService.getCurrentUser()?.role;
  const allowed = role === 'Admin' || role === 'Manager';

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [overview, setOverview] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartType, setChartType] = useState('bar');

  // Ignore responses of outdated requests when filters change quickly.
  const requestId = useRef(0);

  const loadReports = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    const [overviewRes, chartRes, breakdownRes] = await Promise.all([
      reportService.getDashboardOverview(filters),
      reportService.getRevenueChartData(filters),
      reportService.getRevenueBreakdown(filters),
    ]);
    if (id !== requestId.current) return;

    if (!overviewRes.success || !chartRes.success || !breakdownRes.success) {
      setError(overviewRes.message || chartRes.message || breakdownRes.message || 'Failed to load report data.');
    } else {
      setOverview(overviewRes.data);
      setChartData(chartRes.data);
      setBreakdown(breakdownRes.data);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    if (allowed) loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadReports]);

  const setFilter = (name) => (value) => setFilters((prev) => ({ ...prev, [name]: name === 'rangeDays' ? Number(value) : value }));
  const isDefault = Object.keys(DEFAULT_FILTERS).every((key) => filters[key] === DEFAULT_FILTERS[key]);

  // Staff / User / Guest cannot see business reports.
  if (!allowed) {
    return (
      <section className="acc-page">
        <h1 className="acc-title">Dashboard</h1>
        <div className="acc-state" role="alert">You do not have permission to view reports.</div>
      </section>
    );
  }

  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === filters.rangeDays)?.label ?? '';
  const groupLabel = GROUP_OPTIONS.find((o) => o.value === filters.groupBy)?.label.toLowerCase() ?? 'day';
  const hasData = overview != null;

  return (
    <section className="acc-page db-page">
      <header className="acc-header">
        <div>
          <h1 className="acc-title">Dashboard</h1>
          <p className="acc-subtitle">Revenue and performance across parking lots · {rangeLabel.toLowerCase()}</p>
        </div>
        <button type="button" id="btn-refresh-dashboard" className="btn btn-outline-cyan" onClick={loadReports} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      <div className="db-filters" role="group" aria-label="Report filters">
        <FilterSelect id="flt-range" label="Period" value={filters.rangeDays} onChange={setFilter('rangeDays')}>
          {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </FilterSelect>
        <FilterSelect id="flt-group" label="Group by" value={filters.groupBy} onChange={setFilter('groupBy')}>
          {GROUP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </FilterSelect>
        <FilterSelect id="flt-lot" label="Parking lot" value={filters.lotId} onChange={setFilter('lotId')}>
          <option value="all">All parking lots</option>
          {REPORT_LOTS.map((lot) => <option key={lot.id} value={lot.id}>{lot.name}</option>)}
        </FilterSelect>
        <FilterSelect id="flt-vehicle" label="Vehicle type" value={filters.vehicleType} onChange={setFilter('vehicleType')}>
          <option value="all">All vehicle types</option>
          {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </FilterSelect>
        <FilterSelect id="flt-payment" label="Payment method" value={filters.paymentMethod} onChange={setFilter('paymentMethod')}>
          <option value="all">All payment methods</option>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </FilterSelect>
        <button
          type="button"
          id="btn-reset-filters"
          className="btn btn-outline-cyan btn-sm db-filters__reset"
          onClick={() => setFilters(DEFAULT_FILTERS)}
          disabled={isDefault}
        >
          Reset filters
        </button>
      </div>

      {error && (
        <div className="auth-alert auth-alert--error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-outline-cyan btn-sm" onClick={loadReports}>Retry</button>
        </div>
      )}

      {!hasData && loading ? (
        <div className="db-cards" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <div className="acc-state" role="status" style={{ gridColumn: '1 / -1' }}>Loading reports...</div>
        </div>
      ) : (
        hasData && (
          <div className={`db-body${loading ? ' db-body--busy' : ''}`} aria-busy={loading}>
            <div className="db-cards">
              <StatCard
                id="card-total-vehicles"
                label="Total vehicles"
                icon={icons.vehicles}
                value={overview.totalVehicles}
                format={(v) => integer.format(v)}
                trendPct={overview.vehiclesChangePct}
                hint={`vs previous ${filters.rangeDays} days`}
              />
              <StatCard
                id="card-total-revenue"
                variant="revenue"
                label="Total revenue"
                icon={icons.revenue}
                value={overview.totalRevenue}
                format={(v) => vnd.format(v)}
                trendPct={overview.revenueChangePct}
                hint={`vs previous ${filters.rangeDays} days`}
              />
              <StatCard
                id="card-occupancy-rate"
                variant="occupancy"
                label="Occupancy rate"
                icon={icons.occupancy}
                value={overview.occupancyRate}
                format={(v) => v.toFixed(1)}
                unit="%"
                hint="Current, open lots only"
                progress={overview.occupancyRate}
              />
            </div>

            <section className="db-panel" aria-label="Revenue chart">
              <div className="db-panel__head">
                <div>
                  <h2 className="db-panel__title">Revenue by {groupLabel}</h2>
                  <p className="db-panel__sub">{rangeLabel} · amounts in VND (hover for details)</p>
                </div>
                <div className="db-toggle" role="group" aria-label="Chart type">
                  <button type="button" id="btn-chart-bar" className="db-toggle__btn" aria-pressed={chartType === 'bar'} onClick={() => setChartType('bar')}>
                    Bar
                  </button>
                  <button type="button" id="btn-chart-line" className="db-toggle__btn" aria-pressed={chartType === 'line'} onClick={() => setChartType('line')}>
                    Line
                  </button>
                </div>
              </div>

              {chartData.length === 0 ? (
                <div className="acc-state">No revenue data for this selection.</div>
              ) : (
                <div className="db-chart__body">
                  <RevenueChart data={chartData} type={chartType} />
                </div>
              )}
            </section>

            {breakdown && (
              <div className="db-breakdown">
                <section className="db-panel" aria-label="Revenue by parking lot">
                  <div className="db-panel__head">
                    <div>
                      <h2 className="db-panel__title">By parking lot</h2>
                      <p className="db-panel__sub">Revenue in period · current occupancy</p>
                    </div>
                  </div>
                  <div className="acc-table-wrap">
                    <table className="acc-table">
                      <thead>
                        <tr>
                          <th>Parking lot</th>
                          <th className="db-num">Vehicles</th>
                          <th className="db-num">Revenue</th>
                          <th className="db-num">Share</th>
                          <th>Occupancy</th>
                        </tr>
                      </thead>
                      <tbody>
                        {breakdown.byLot.map((lot) => (
                          <tr key={lot.id}>
                            <td>
                              <div className="acc-name">{lot.name}</div>
                              <div className="acc-sub">{lot.capacity} slots</div>
                            </td>
                            <td className="db-num">{integer.format(lot.vehicles)}</td>
                            <td className="db-num">{vnd.format(lot.revenue)}</td>
                            <td className="db-num">{lot.sharePct.toFixed(1)}%</td>
                            <td>
                              {lot.isActive ? (
                                <div className="db-occ">
                                  <div className="db-progress" role="progressbar" aria-valuenow={lot.occupancyRate} aria-valuemin={0} aria-valuemax={100} aria-label={`${lot.name} occupancy`}>
                                    <div className="db-progress__bar" style={{ width: `${lot.occupancyRate}%` }} />
                                  </div>
                                  <span className="db-occ__val">{lot.occupancyRate.toFixed(1)}%</span>
                                </div>
                              ) : (
                                <span className="db-closed">Closed</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <div className="db-breakdown__side">
                  <section className="db-panel" aria-label="Revenue by vehicle type">
                    <div className="db-panel__head">
                      <h2 className="db-panel__title">By vehicle type</h2>
                    </div>
                    <ShareBars rows={breakdown.byVehicleType} />
                  </section>
                  <section className="db-panel" aria-label="Revenue by payment method">
                    <div className="db-panel__head">
                      <h2 className="db-panel__title">By payment method</h2>
                    </div>
                    <ShareBars rows={breakdown.byPaymentMethod} amber />
                  </section>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </section>
  );
}
