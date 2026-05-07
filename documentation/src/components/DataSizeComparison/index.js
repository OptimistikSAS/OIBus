import React, { useState, useMemo } from 'react';

const DataSizeComparison = () => {
  const [pointsPerSecond, setPointsPerSecond] = useState(1);
  const [signalsPerRow, setSignalsPerRow] = useState(3);
  const [safetyBuffer, setSafetyBuffer] = useState(30);
  const [networkBuffer, setNetworkBuffer] = useState(50);
  const [networkFailureHours, setNetworkFailureHours] = useState(1);

  // Auto-recalculate on every input change
  const results = useMemo(() => {
    const K = Math.max(1, Math.round(signalsPerRow));
    const sizes = {
      json: 77,
      csvRow: 38,
      csvColumn: (25 + 5 * K) / K,
      csvColumnRow: (30 + 5 * K) / K
    };
    const multiplier = (1 + safetyBuffer / 100) * (1 + networkBuffer / 100);
    const failureSecs = networkFailureHours * 3600;

    const formats = [
      { key: 'json', label: 'JSON' },
      { key: 'csvRow', label: 'CSV Row' },
      { key: 'csvColumn', label: `CSV Column (K=${K})` },
      { key: 'csvColumnRow', label: `CSV Column-Row (K=${K})` }
    ].map(f => {
      const bytesPerPoint = sizes[f.key];
      const baseThroughput = pointsPerSecond * bytesPerPoint;
      const bufferedThroughput = baseThroughput * multiplier;
      const failureCache = bufferedThroughput * failureSecs;
      return { ...f, bytesPerPoint, baseThroughput, bufferedThroughput, failureCache };
    });

    return { formats, multiplier, K };
  }, [pointsPerSecond, signalsPerRow, safetyBuffer, networkBuffer, networkFailureHours]);

  const formatBytes = b => {
    if (b < 1024) return `${b.toFixed(0)} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };
  const formatRate = b => `${formatBytes(b)}/s`;

  /* ── styles (Infima variables — dark-mode safe) ─────────────────────────── */

  const card = {
    margin: '1.5rem 0',
    padding: '1.25rem 1.5rem',
    borderRadius: '8px',
    border: '1px solid var(--ifm-color-emphasis-300)',
    backgroundColor: 'var(--ifm-background-surface-color)'
  };

  const grid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '0.5rem 1.5rem',
    marginBottom: '1.25rem'
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    fontSize: '0.88rem',
    color: 'var(--ifm-font-color-base)'
  };

  const inputStyle = {
    padding: '0.35rem 0.6rem',
    width: '90px',
    borderRadius: '6px',
    border: '1px solid var(--ifm-color-emphasis-300)',
    backgroundColor: 'var(--ifm-background-color)',
    color: 'var(--ifm-font-color-base)',
    fontFamily: 'var(--ifm-font-family-monospace)',
    fontSize: '0.88rem',
    textAlign: 'right'
  };

  const thStyle = {
    padding: '0.5rem 0.75rem',
    textAlign: 'right',
    border: '1px solid var(--ifm-color-emphasis-200)',
    backgroundColor: 'var(--ifm-color-emphasis-100)',
    color: 'var(--ifm-font-color-base)',
    fontWeight: 600,
    fontSize: '0.82rem',
    whiteSpace: 'nowrap'
  };

  const tdStyle = {
    padding: '0.4rem 0.75rem',
    textAlign: 'right',
    border: '1px solid var(--ifm-color-emphasis-200)',
    fontFamily: 'var(--ifm-font-family-monospace)',
    fontSize: '0.85rem',
    color: 'var(--ifm-font-color-base)'
  };

  const tdLabelStyle = {
    ...tdStyle,
    textAlign: 'left',
    fontFamily: 'var(--ifm-font-family-base)'
  };

  /* ── render ─────────────────────────────────────────────────────────────── */

  return (
    <div style={card}>
      {/* inputs */}
      <div style={grid}>
        <label style={labelStyle}>
          Data points per second
          <input
            type="number"
            value={pointsPerSecond}
            onChange={e => setPointsPerSecond(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.1"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Points per row (K)
          <input
            type="number"
            value={signalsPerRow}
            onChange={e => setSignalsPerRow(parseInt(e.target.value) || 1)}
            min="1"
            max="100"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Safety buffer (%)
          <input
            type="number"
            value={safetyBuffer}
            onChange={e => setSafetyBuffer(parseInt(e.target.value) || 0)}
            min="0"
            max="200"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Network overhead (%)
          <input
            type="number"
            value={networkBuffer}
            onChange={e => setNetworkBuffer(parseInt(e.target.value) || 0)}
            min="0"
            max="200"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Outage duration (hours)
          <input
            type="number"
            value={networkFailureHours}
            onChange={e => setNetworkFailureHours(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.5"
            style={inputStyle}
          />
        </label>
      </div>

      {/* multiplier note */}
      <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem', color: 'var(--ifm-color-emphasis-600)' }}>
        Combined overhead multiplier:{' '}
        <strong style={{ fontFamily: 'var(--ifm-font-family-monospace)' }}>×{results.multiplier.toFixed(3)}</strong> — safety {safetyBuffer}
        % × network overhead {networkBuffer}%
      </div>

      {/* results table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88em' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>Format</th>
              <th style={thStyle}>Bytes / point</th>
              <th style={thStyle}>Base throughput</th>
              <th style={thStyle}>Buffered throughput</th>
              <th style={thStyle}>Cache for {networkFailureHours} h outage</th>
            </tr>
          </thead>
          <tbody>
            {results.formats.map((f, i) => (
              <tr key={f.key} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--ifm-color-emphasis-100)' }}>
                <td style={tdLabelStyle}>{f.label}</td>
                <td style={tdStyle}>{f.bytesPerPoint % 1 === 0 ? f.bytesPerPoint.toFixed(0) : f.bytesPerPoint.toFixed(1)}</td>
                <td style={tdStyle}>{formatRate(f.baseThroughput)}</td>
                <td style={tdStyle}>{formatRate(f.bufferedThroughput)}</td>
                <td style={tdStyle}>{formatBytes(f.failureCache)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* footer hint */}
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--ifm-color-emphasis-600)' }}>
        The <strong>Cache for outage</strong> column is the minimum value to set for <strong>Maximum storage size</strong> in North
        connector cache settings. K applies to Column formats only — increase it to see the efficiency gain from shared timestamps.
      </p>
    </div>
  );
};

export default DataSizeComparison;
