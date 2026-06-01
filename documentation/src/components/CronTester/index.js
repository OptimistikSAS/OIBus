import { useState, useMemo } from 'react';
import cronstrue from 'cronstrue';

const PRESETS = [
  { label: 'Every second', expr: '* * * * * *' },
  { label: 'Every 10 s', expr: '/10 * * * * *' },
  { label: 'Every minute', expr: '0 * * * * *' },
  { label: 'Every 10 min', expr: '0 /10 * * * *' },
  { label: 'Every hour', expr: '0 0 * * * *' },
  { label: 'Every 24 h', expr: '0 0 0 * * *' }
];

const FIELD_DEFS = [
  { label: 'Seconds', range: '0 – 59', min: 0, max: 59 },
  { label: 'Minutes', range: '0 – 59', min: 0, max: 59 },
  { label: 'Hours', range: '0 – 23', min: 0, max: 23 },
  { label: 'Day', range: '1 – 31', min: 1, max: 31 },
  { label: 'Month', range: '1 – 12', min: 1, max: 12 },
  { label: 'Weekday', range: '0 – 6', min: 0, max: 6 }
];

/** Parse one cron field into a Set of valid integers, or null for wildcard '*'. */
function parseField(field, min, max) {
  if (field === '*') return null;
  const values = new Set();
  for (const part of field.split(',')) {
    if (part.startsWith('/')) {
      // /n  →  every n starting from min
      const step = parseInt(part.slice(1), 10);
      if (!isNaN(step) && step > 0) for (let i = min; i <= max; i += step) values.add(i);
    } else if (part.includes('/')) {
      // start/n  or  */n
      const [rangePart, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const start = rangePart === '*' ? min : parseInt(rangePart, 10);
      if (!isNaN(step) && step > 0 && !isNaN(start)) for (let i = start; i <= max; i += step) values.add(i);
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (!isNaN(a) && !isNaN(b)) for (let i = a; i <= b; i++) values.add(i);
    } else {
      const v = parseInt(part, 10);
      if (!isNaN(v)) values.add(v);
    }
  }
  return values;
}

/** Compute the next `count` execution times for a 6-field cron expression. */
function getNextRuns(cronExpr, count = 5) {
  const fields = cronExpr.trim().split(/\s+/);
  if (fields.length !== 6) return null;
  try {
    const [secsSet, minsSet, hrsSet, domsSet, monsSet, dowsSet] = FIELD_DEFS.map((def, i) => parseField(fields[i], def.min, def.max));

    const ok = (v, s) => s === null || s.has(v);

    const runs = [];
    let d = new Date(Date.now() + 1000);
    d.setMilliseconds(0);

    // Smart scheduler: skip entire month / day / hour / minute at a time
    // instead of iterating second-by-second, so even yearly schedules resolve fast.
    let guard = 0;
    while (runs.length < count && guard++ < 100_000) {
      const mon = d.getMonth() + 1; // 1-indexed
      const dom = d.getDate();
      const dow = d.getDay(); // 0=Sunday
      const hr = d.getHours();
      const min = d.getMinutes();
      const sec = d.getSeconds();

      if (!ok(mon, monsSet)) {
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0);
        continue;
      }
      if (!ok(dom, domsSet) || !ok(dow, dowsSet)) {
        d = new Date(d.getFullYear(), d.getMonth(), dom + 1, 0, 0, 0, 0);
        continue;
      }
      if (!ok(hr, hrsSet)) {
        d = new Date(d.getFullYear(), d.getMonth(), dom, hr + 1, 0, 0, 0);
        continue;
      }
      if (!ok(min, minsSet)) {
        d = new Date(d.getFullYear(), d.getMonth(), dom, hr, min + 1, 0, 0);
        continue;
      }
      if (!ok(sec, secsSet)) {
        d = new Date(d.getTime() + 1000);
        continue;
      }

      runs.push(new Date(d));
      d = new Date(d.getTime() + 1000);
    }
    return runs;
  } catch {
    return null;
  }
}

function formatRun(date) {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

const CronTester = () => {
  const [expr, setExpr] = useState('0 /10 * * * *');
  const [copied, setCopied] = useState(false);

  const fields = expr.trim().split(/\s+/);
  const is6 = fields.length === 6;
  const nextRuns = useMemo(() => getNextRuns(expr), [expr]);

  let description = '';
  let valid = false;
  try {
    description = cronstrue.toString(expr);
    valid = true;
  } catch {
    description = 'Invalid cron expression';
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(expr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  /* ── styles ─────────────────────────────────────────────────────────────── */

  const card = {
    margin: '1.5rem 0',
    padding: '1.25rem 1.5rem',
    borderRadius: '8px',
    border: '1px solid var(--ifm-color-emphasis-300)',
    backgroundColor: 'var(--ifm-background-surface-color)'
  };

  const chip = active => ({
    padding: '0.2rem 0.6rem',
    borderRadius: '20px',
    border: `1px solid ${active ? 'var(--ifm-color-primary)' : 'var(--ifm-color-emphasis-300)'}`,
    backgroundColor: active ? 'var(--ifm-color-primary)' : 'transparent',
    color: active ? '#fff' : 'var(--ifm-font-color-base)',
    fontSize: '0.78rem',
    cursor: 'pointer',
    fontFamily: 'var(--ifm-font-family-monospace)',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap'
  });

  const input = {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: `1px solid ${!expr || valid ? 'var(--ifm-color-emphasis-300)' : 'var(--ifm-color-danger)'}`,
    backgroundColor: 'var(--ifm-background-color)',
    color: 'var(--ifm-font-color-base)',
    fontFamily: 'var(--ifm-font-family-monospace)',
    fontSize: '1rem',
    outline: 'none'
  };

  const copyBtn = {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--ifm-color-emphasis-300)',
    backgroundColor: 'transparent',
    color: 'var(--ifm-font-color-base)',
    cursor: 'pointer',
    fontSize: '0.82rem',
    whiteSpace: 'nowrap'
  };

  const fieldBox = {
    textAlign: 'center',
    padding: '0.45rem 0.2rem',
    borderRadius: '6px',
    border: '1px solid var(--ifm-color-emphasis-200)',
    backgroundColor: 'var(--ifm-color-emphasis-100)'
  };

  const descBox = {
    padding: '0.55rem 0.9rem',
    borderRadius: '6px',
    borderLeft: `4px solid ${valid ? 'var(--ifm-color-success)' : 'var(--ifm-color-danger)'}`,
    backgroundColor: 'var(--ifm-color-emphasis-100)',
    fontSize: '0.9rem',
    color: 'var(--ifm-font-color-base)'
  };

  const sectionLabel = {
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--ifm-color-emphasis-600)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '0.4rem'
  };

  /* ── render ─────────────────────────────────────────────────────────────── */

  return (
    <div style={card}>
      {/* ── presets ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.85rem' }}>
        {PRESETS.map(p => (
          <button key={p.expr} onClick={() => setExpr(p.expr)} style={chip(expr === p.expr)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── input ── */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.9rem' }}>
        <input
          type="text"
          value={expr}
          onChange={e => setExpr(e.target.value)}
          placeholder="e.g. 0 /10 * * * *"
          spellCheck={false}
          style={input}
        />
        <button onClick={handleCopy} style={copyBtn} title="Copy expression">
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>

      {/* ── field breakdown ── */}
      {is6 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '0.4rem',
            marginBottom: '0.9rem'
          }}
        >
          {FIELD_DEFS.map((def, i) => (
            <div key={def.label} style={fieldBox}>
              <div
                style={{
                  fontFamily: 'var(--ifm-font-family-monospace)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: 'var(--ifm-color-primary)',
                  marginBottom: '0.15rem',
                  wordBreak: 'break-all'
                }}
              >
                {fields[i] ?? '?'}
              </div>
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ifm-font-color-base)' }}>{def.label}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--ifm-color-emphasis-600)' }}>{def.range}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── description ── */}
      {expr && (
        <div style={{ ...descBox, marginBottom: '0.9rem' }}>
          <strong>Schedule: </strong>
          {description}
        </div>
      )}

      {/* ── next runs ── */}
      {valid && nextRuns && nextRuns.length > 0 && (
        <div>
          <div style={sectionLabel}>Next {nextRuns.length} executions</div>
          <ol style={{ margin: 0, paddingLeft: '1.3rem' }}>
            {nextRuns.map((run, i) => (
              <li
                key={i}
                style={{
                  fontFamily: 'var(--ifm-font-family-monospace)',
                  fontSize: '0.85rem',
                  padding: '0.18rem 0',
                  color: 'var(--ifm-font-color-base)'
                }}
              >
                {formatRun(run)}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ── no runs warning ── */}
      {valid && nextRuns && nextRuns.length === 0 && (
        <div style={{ fontSize: '0.85rem', color: 'var(--ifm-color-warning-dark)' }}>
          ⚠️ No executions found within the search window. Check your expression.
        </div>
      )}
    </div>
  );
};

export default CronTester;
