import React, { useState } from 'react';

const DataSizeComparison = () => {
  const [pointsPerSecond, setPointsPerSecond] = useState(1);
  const [signalsPerRow, setSignalsPerRow] = useState(3);
  const [safetyBuffer, setSafetyBuffer] = useState(30);
  const [networkBuffer, setNetworkBuffer] = useState(50);
  const [networkFailureHours, setNetworkFailureHours] = useState(1);
  const [results, setResults] = useState(null);

  const calculateThroughput = () => {
    const K = Math.max(1, Math.round(signalsPerRow));
    const sizes = {
      json: 102,
      csvRow: 38,
      csvColumn: (25 + 5 * K) / K,
      csvColumnRow: (30 + 5 * K) / K,
    };

    const multiplier = (1 + safetyBuffer / 100) * (1 + networkBuffer / 100);
    const failureSeconds = networkFailureHours * 3600;

    const formats = [
      { key: 'json', label: 'JSON' },
      { key: 'csvRow', label: 'CSV Row' },
      { key: 'csvColumn', label: `CSV Column (K=${K})` },
      { key: 'csvColumnRow', label: `CSV Column-Row (K=${K})` },
    ];

    const computedFormats = formats.map(f => {
      const bytesPerPoint = sizes[f.key];
      const baseThroughput = pointsPerSecond * bytesPerPoint;
      const bufferedThroughput = baseThroughput * multiplier;
      const failureCache = bufferedThroughput * failureSeconds;
      return {
        ...f,
        bytesPerPoint,
        baseThroughput,
        bufferedThroughput,
        failureCache,
      };
    });

    setResults({ formats: computedFormats, multiplier, failureHours: networkFailureHours, K });
  };

  const formatBytes = bytes => {
    if (bytes < 1024) return `${bytes.toFixed(0)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const inputStyle = { padding: '6px 8px', width: '100px', marginLeft: '8px', borderRadius: '4px', border: '1px solid #ccc' };
  const labelStyle = { display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '4px' };
  const thStyle = { padding: '8px 10px', textAlign: 'right', border: '1px solid #ddd', background: '#f5f5f5', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '6px 10px', textAlign: 'right', border: '1px solid #ddd' };
  const tdLabelStyle = { padding: '6px 10px', textAlign: 'left', border: '1px solid #ddd' };

  return (
    <div style={{ margin: '20px 0', padding: '16px', border: '1px solid #ccc', borderRadius: '6px' }}>
      <h4 style={{ marginTop: 0 }}>Throughput & Cache Comparison</h4>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '4px 24px', marginBottom: '16px' }}>
        <label style={labelStyle}>
          Data points per second:
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
          Points per row (K):
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
          Safety buffer (%):
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
          Network buffer (%):
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
          Network failure duration (hours):
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

      <button
        onClick={calculateThroughput}
        style={{ padding: '8px 18px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        Calculate
      </button>

      {results && (
        <div style={{ marginTop: '16px' }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.9em', color: '#555' }}>
            Combined overhead multiplier: ×{results.multiplier.toFixed(3)}
            &nbsp;(safety {safetyBuffer}% × network {networkBuffer}%)
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Format</th>
                  <th style={thStyle}>Bytes / point</th>
                  <th style={thStyle}>Base (bytes/s)</th>
                  <th style={thStyle}>Buffered (bytes/s)</th>
                  <th style={thStyle}>Cache for {results.failureHours}h outage</th>
                </tr>
              </thead>
              <tbody>
                {results.formats.map((f, i) => (
                  <tr key={f.key} style={{ background: i % 2 === 0 ? 'transparent' : '#fafafa' }}>
                    <td style={tdLabelStyle}>{f.label}</td>
                    <td style={tdStyle}>{f.bytesPerPoint % 1 === 0 ? f.bytesPerPoint.toFixed(0) : f.bytesPerPoint.toFixed(1)}</td>
                    <td style={tdStyle}>{f.baseThroughput.toFixed(2)}</td>
                    <td style={tdStyle}>{f.bufferedThroughput.toFixed(2)}</td>
                    <td style={tdStyle}>{formatBytes(f.failureCache)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: '0.85em', color: '#777' }}>
            K = points per row applies only to Column formats. Increase K to see the efficiency gain from sharing timestamps.
          </p>
        </div>
      )}
    </div>
  );
};

export default DataSizeComparison;
