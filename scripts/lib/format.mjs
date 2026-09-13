// Text output helpers: aligned tables, money, dates, relative days.

export function money(cents, currency = 'NZD') {
  const n = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

export function isoDate(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function dateTime(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysAgo(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export function short(id) {
  return String(id || '').slice(0, 8);
}

export function truncate(s, n = 60) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '...' : s;
}

// columns: [{ key, label, align: 'left'|'right', width?, format? }]
export function table(rows, columns) {
  if (!rows.length) return '  (none)';
  const cells = rows.map((r) =>
    columns.map((c) => {
      const raw = c.format ? c.format(r[c.key], r) : r[c.key];
      return raw === null || raw === undefined ? '' : String(raw);
    }),
  );
  const widths = columns.map((c, i) => {
    const w = Math.max(c.label.length, ...cells.map((row) => row[i].length));
    return c.width ? Math.min(w, c.width) : w;
  });
  const fit = (s, i) => {
    const w = widths[i];
    if (s.length > w) s = s.slice(0, w - 3) + '...';
    return columns[i].align === 'right' ? s.padStart(w) : s.padEnd(w);
  };
  const line = (arr) => '  ' + arr.map((s, i) => fit(s, i)).join('  ');
  const out = [line(columns.map((c) => c.label)), '  ' + widths.map((w) => '-'.repeat(w)).join('  ')];
  for (const row of cells) out.push(line(row));
  return out.join('\n');
}

export function heading(text) {
  return `\n${text}\n${'='.repeat(text.length)}`;
}
