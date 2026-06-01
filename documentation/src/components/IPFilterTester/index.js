import { useState } from 'react';

const LOCALHOST_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:0:0:1'];

const formatRegex = filter => filter.replace(/\\/g, '\\\\').replace(/\./g, '\\.').replace(/\*/g, '.*');

/**
 * Returns { allowed: boolean, matchedRule: string | null }
 * matchedRule is null when the IP is blocked (no rule matched).
 */
const testIPOnFilter = (userFilters, ipToCheck) => {
  // Localhost addresses are permanently allowed.
  if (LOCALHOST_ADDRESSES.includes(ipToCheck)) {
    return { allowed: true, matchedRule: 'localhost (always allowed)' };
  }

  for (const filter of userFilters) {
    if (!filter) continue;

    if (filter === '*') {
      return { allowed: true, matchedRule: '*' };
    }

    const regex = new RegExp(`^${formatRegex(filter)}$`);
    const isIPv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipToCheck);

    if (isIPv4) {
      if (regex.test(ipToCheck) || regex.test(`::ffff:${ipToCheck}`)) {
        return { allowed: true, matchedRule: filter };
      }
    } else {
      const ipv4MappedMatch = ipToCheck.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (ipv4MappedMatch) {
        if (regex.test(ipv4MappedMatch[1]) || regex.test(ipToCheck)) {
          return { allowed: true, matchedRule: filter };
        }
      } else if (regex.test(ipToCheck)) {
        return { allowed: true, matchedRule: filter };
      }
    }
  }

  return { allowed: false, matchedRule: null };
};

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

const resultStyles = allowed => ({
  padding: '0.75rem 1rem',
  borderRadius: 'var(--ifm-global-radius)',
  border: `1px solid ${allowed ? 'var(--ifm-color-success-dark)' : 'var(--ifm-color-danger-dark)'}`,
  backgroundColor: allowed ? 'var(--ifm-color-success-contrast-background)' : 'var(--ifm-color-danger-contrast-background)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.6rem',
  marginTop: '1rem'
});

// ---------------------------------------------------------------------------

const IPFilterTester = () => {
  const [filterText, setFilterText] = useState('');
  const [ipToTest, setIpToTest] = useState('192.168.1.1');
  const [result, setResult] = useState(null);

  const runTest = () => {
    const filters = filterText
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
    setResult(testIPOnFilter(filters, ipToTest.trim()));
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') runTest();
  };

  return (
    <div style={card}>
      {/* ── Filter Rules ── */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={fieldLabel}>
          Filter Rules <span style={fieldHint}>(one per line)</span>
        </label>
        <textarea
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder={'192.168.1.*\n10.0.0.5\n*'}
          rows={4}
          style={{ ...inputBase, resize: 'vertical' }}
        />
      </div>

      {/* ── IP Address + Test button ── */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>IP Address to Test</label>
          <input
            type="text"
            value={ipToTest}
            onChange={e => setIpToTest(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 192.168.1.100 or ::ffff:10.0.0.1"
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
            // Align with input bottom
            height: '2.25rem'
          }}
        >
          Test
        </button>
      </div>

      {/* ── Result ── */}
      {result !== null && (
        <div style={resultStyles(result.allowed)}>
          <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{result.allowed ? '✅' : '❌'}</span>
          <div style={{ fontSize: '0.9rem' }}>
            <strong
              style={{
                color: result.allowed ? 'var(--ifm-color-success-darkest)' : 'var(--ifm-color-danger-darkest)'
              }}
            >
              {result.allowed ? 'Allowed' : 'Blocked'}
            </strong>
            {result.matchedRule ? (
              <span style={{ color: 'var(--ifm-color-emphasis-700)', marginLeft: '0.4rem' }}>
                — matched rule{' '}
                <code
                  style={{
                    fontSize: '0.85rem',
                    padding: '0.1rem 0.35rem',
                    borderRadius: '3px',
                    backgroundColor: 'var(--ifm-color-emphasis-200)'
                  }}
                >
                  {result.matchedRule}
                </code>
              </span>
            ) : (
              <span style={{ color: 'var(--ifm-color-emphasis-700)', marginLeft: '0.4rem' }}>— no rule matched this address</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IPFilterTester;
