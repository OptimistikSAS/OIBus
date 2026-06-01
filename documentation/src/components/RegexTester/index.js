import { useState } from 'react';

// ---------------------------------------------------------------------------
// Styles (inline, using Infima CSS vars for dark-mode compatibility)
// ---------------------------------------------------------------------------

const card = {
  margin: '1.5rem 0',
  padding: '1.25rem 1.5rem',
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 'var(--ifm-global-radius)',
  backgroundColor: 'var(--ifm-background-surface-color)'
};

const fieldLabel = {
  display: 'block',
  marginBottom: '0.35rem',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: 'var(--ifm-font-color-base)'
};

const fieldHint = {
  fontWeight: 400,
  fontSize: '0.8rem',
  color: 'var(--ifm-color-emphasis-600)'
};

const inputBase = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 'var(--ifm-global-radius)',
  fontFamily: 'var(--ifm-font-family-monospace)',
  fontSize: '0.875rem',
  backgroundColor: 'var(--ifm-background-color)',
  color: 'var(--ifm-font-color-base)',
  boxSizing: 'border-box',
  outline: 'none'
};

const RESULT_COLORS = {
  match: {
    border: 'var(--ifm-color-success-dark)',
    bg: 'var(--ifm-color-success-contrast-background)',
    label: 'var(--ifm-color-success-darkest)'
  },
  nomatch: {
    border: 'var(--ifm-color-danger-dark)',
    bg: 'var(--ifm-color-danger-contrast-background)',
    label: 'var(--ifm-color-danger-darkest)'
  },
  error: {
    border: 'var(--ifm-color-warning-dark)',
    bg: 'var(--ifm-color-warning-contrast-background)',
    label: 'var(--ifm-color-warning-darkest)'
  }
};

const resultBanner = type => {
  const c = RESULT_COLORS[type] || RESULT_COLORS.nomatch;
  return {
    padding: '0.75rem 1rem',
    borderRadius: 'var(--ifm-global-radius)',
    border: `1px solid ${c.border}`,
    backgroundColor: c.bg,
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    marginTop: '1rem'
  };
};

const EXAMPLES = [
  { pattern: '.*', label: 'All files' },
  { pattern: '.*\\.txt', label: 'Text files' },
  { pattern: '.*\\.csv', label: 'CSV files' },
  { pattern: '.*\\.csv|.*\\.xlsx', label: 'CSV or Excel files' },
  { pattern: 'data_.*\\.json', label: 'JSON files starting with "data_"' }
];

// ---------------------------------------------------------------------------

const RegexTester = () => {
  const [pattern, setPattern] = useState('.*\\.csv');
  const [filename, setFilename] = useState('example.csv');
  const [result, setResult] = useState(null);

  const runTest = () => {
    if (!pattern) {
      setResult({ type: 'error', detail: 'Pattern is empty.' });
      return;
    }
    try {
      const regex = new RegExp(pattern);
      const matched = regex.test(filename);
      setResult({ type: matched ? 'match' : 'nomatch' });
    } catch (e) {
      setResult({ type: 'error', detail: e.message });
    }
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') runTest();
  };

  const applyExample = ex => {
    setPattern(ex.pattern);
    setResult(null);
  };

  return (
    <div style={card}>
      {/* ── Regex Pattern ── */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={fieldLabel}>
          Regex Pattern <span style={fieldHint}>(JavaScript RegExp)</span>
        </label>
        <input
          type="text"
          value={pattern}
          onChange={e => {
            setPattern(e.target.value);
            setResult(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="e.g. .*\.csv"
          style={inputBase}
        />
      </div>

      {/* ── Filename + Test button ── */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', marginBottom: '0' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Filename to Test</label>
          <input
            type="text"
            value={filename}
            onChange={e => {
              setFilename(e.target.value);
              setResult(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="e.g. data.csv"
            style={inputBase}
          />
        </div>
        <button
          onClick={runTest}
          style={{
            padding: '0.5rem 1.5rem',
            backgroundColor: 'var(--ifm-color-primary)',
            color: '#000',
            fontWeight: 700,
            fontSize: '0.875rem',
            border: 'none',
            borderRadius: 'var(--ifm-global-radius)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            height: '2.25rem'
          }}
        >
          Test
        </button>
      </div>

      {/* ── Result banner ── */}
      {result !== null && (
        <div style={resultBanner(result.type)}>
          <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>
            {result.type === 'match' ? '✅' : result.type === 'error' ? '⚠️' : '❌'}
          </span>
          <div style={{ fontSize: '0.9rem' }}>
            <strong style={{ color: RESULT_COLORS[result.type]?.label }}>
              {result.type === 'match' ? 'Matches' : result.type === 'error' ? 'Invalid pattern' : 'No match'}
            </strong>
            {result.type === 'match' && (
              <span style={{ color: 'var(--ifm-color-emphasis-700)', marginLeft: '0.4rem' }}>— the filename matches the pattern</span>
            )}
            {result.type === 'nomatch' && (
              <span style={{ color: 'var(--ifm-color-emphasis-700)', marginLeft: '0.4rem' }}>
                — the filename does not match the pattern
              </span>
            )}
            {result.type === 'error' && (
              <span style={{ color: 'var(--ifm-color-emphasis-700)', marginLeft: '0.4rem' }}>
                —{' '}
                <code
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '3px',
                    backgroundColor: 'var(--ifm-color-emphasis-200)'
                  }}
                >
                  {result.detail}
                </code>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Common examples ── */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--ifm-color-emphasis-200)'
        }}
      >
        <p
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--ifm-color-emphasis-700)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          Common Examples
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {EXAMPLES.map(ex => (
            <button
              key={ex.pattern}
              onClick={() => applyExample(ex)}
              title={ex.label}
              style={{
                padding: '0.2rem 0.6rem',
                border: '1px solid var(--ifm-color-emphasis-300)',
                borderRadius: 'var(--ifm-global-radius)',
                backgroundColor: 'var(--ifm-background-color)',
                color: 'var(--ifm-font-color-base)',
                fontFamily: 'var(--ifm-font-family-monospace)',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {ex.pattern}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegexTester;
