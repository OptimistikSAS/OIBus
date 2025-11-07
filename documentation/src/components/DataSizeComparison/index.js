import React, { useState } from 'react';

const DataSizeComparison = () => {
  const [pointsPerSecond, setPointsPerSecond] = useState(1);
  const [safetyBuffer, setSafetyBuffer] = useState(30);
  const [networkBuffer, setNetworkBuffer] = useState(50);
  const [networkFailureHours, setNetworkFailureHours] = useState(1);
  const [results, setResults] = useState(null);

  const formatSizes = {
    json: 106,
    csv: 38
  };

  const calculateThroughput = () => {
    const jsonSize = formatSizes.json;
    const csvSize = formatSizes.csv;

    const jsonBase = pointsPerSecond * jsonSize;
    const csvBase = pointsPerSecond * csvSize;

    const multiplier = (1 + safetyBuffer / 100) * (1 + networkBuffer / 100);
    const jsonBuffered = jsonBase * multiplier;
    const csvBuffered = csvBase * multiplier;

    const failureSeconds = networkFailureHours * 3600;
    const jsonFailureCache = jsonBuffered * failureSeconds;
    const csvFailureCache = csvBuffered * failureSeconds;

    setResults({
      jsonBase: jsonBase.toFixed(2),
      csvBase: csvBase.toFixed(2),
      jsonBuffered: jsonBuffered.toFixed(2),
      csvBuffered: csvBuffered.toFixed(2),
      jsonSize,
      csvSize,
      multiplier,
      jsonFailureCache,
      csvFailureCache,
      failureHours: networkFailureHours
    });
  };

  return (
    <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h4>Throughput & Cache Comparison</h4>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Data Points per Second:
          <input
            type="number"
            value={pointsPerSecond}
            onChange={e => setPointsPerSecond(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.1"
            style={{ padding: '8px', width: '300px', marginLeft: '10px' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Safety Buffer (%):
          <input
            type="number"
            value={safetyBuffer}
            onChange={e => setSafetyBuffer(parseInt(e.target.value) || 0)}
            min="0"
            max="200"
            style={{ padding: '8px', width: '300px', marginLeft: '45px' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Network Buffer (%):
          <input
            type="number"
            value={networkBuffer}
            onChange={e => setNetworkBuffer(parseInt(e.target.value) || 0)}
            min="0"
            max="200"
            style={{ padding: '8px', width: '300px', marginLeft: '45px' }}
          />
        </label>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Network Failure Duration (hours):
          <input
            type="number"
            value={networkFailureHours}
            onChange={e => setNetworkFailureHours(parseFloat(e.target.value) || 0)}
            min="0"
            step="0.1"
            style={{ padding: '8px', width: '300px', marginLeft: '10px' }}
          />
        </label>
      </div>

      <button
        onClick={calculateThroughput}
        style={{ padding: '8px 16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        Calculate
      </button>

      {results && (
        <div style={{ marginTop: '10px' }}>
          <h4>Results:</h4>

          <div style={{ marginBottom: '10px' }}>
            <strong>Throughput Comparison:</strong>
            <div style={{ marginLeft: '20px', marginTop: '5px' }}>
              <div>
                JSON: {results.jsonBuffered} bytes/sec (≈ {Math.ceil((parseFloat(results.jsonBuffered) * 60) / 1024)} KB/min)
              </div>
              <div>
                CSV: {results.csvBuffered} bytes/sec (≈ {Math.ceil((parseFloat(results.csvBuffered) * 60) / 1024)} KB/min)
              </div>
              <div>CSV is {(((results.jsonSize - results.csvSize) / results.jsonSize) * 100).toFixed(1)}% more efficient</div>
            </div>
          </div>

          <div style={{ marginBottom: '10px' }}>
            <strong>Cache Requirements for {results.failureHours} hour failure:</strong>
            <div style={{ marginLeft: '20px', marginTop: '5px' }}>
              <div>JSON: {(results.jsonFailureCache / 1024 / 1024).toFixed(2)} MB</div>
              <div>CSV: {(results.csvFailureCache / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>

          <div>
            <strong>Recommendation:</strong>
            <div style={{ marginLeft: '20px', marginTop: '5px' }}>
              Configure cache to at least {(Math.max(results.jsonFailureCache, results.csvFailureCache) / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSizeComparison;
