import React, { useState } from 'react';

const LOCALHOST_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:0:0:1'];

const formatRegex = filter => {
  // Escape special regex characters and replace wildcards with regex patterns
  return filter
    .replace(/\\/g, '\\\\') // Escape backslashes first
    .replace(/\./g, '\\.') // Escape dots for IPv4
    .replace(/\*/g, '.*'); // Replace * with .* for wildcard matching
};

const testIPOnFilter = (ipFilters, ipToCheck) => {
  const allFilters = [...LOCALHOST_ADDRESSES, ...ipFilters];
  return allFilters.some(filter => {
    if (filter === '*') {
      return true;
    }
    // Format the regex for IPv4 and IPv6
    const formattedRegex = formatRegex(filter);
    const regex = new RegExp(`^${formattedRegex}$`);

    // Test for IPv4
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipToCheck)) {
      return regex.test(ipToCheck) || regex.test(`::ffff:${ipToCheck}`);
    }
    // Test for IPv6-mapped IPv4 (e.g., ::ffff:192.168.1.1)
    else {
      const ipv4MappedPattern = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/;
      const match = ipToCheck.match(ipv4MappedPattern);
      if (match) {
        const ipv4Part = match[1];
        return regex.test(ipv4Part) || regex.test(ipToCheck);
      }
      // Test for pure IPv6
      return regex.test(ipToCheck);
    }
  });
};

const IPFilterTester = () => {
  const [ipFilters, setIpFilters] = useState([]);
  const [ipToTest, setIpToTest] = useState('192.168.1.1');
  const [result, setResult] = useState(null);

  const handleTest = () => {
    const isAllowed = testIPOnFilter(ipFilters.split('\n').filter(Boolean), ipToTest);
    setResult(isAllowed ? '✅ IP address is allowed.' : '❌ IP address is NOT allowed.');
  };

  return (
    <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h4>IP Filter Tester</h4>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          IP Filter Rules (one per line):
          <textarea
            value={ipFilters}
            onChange={e => setIpFilters(e.target.value)}
            placeholder="Enter IP filter rules (e.g., 192.168.1.*, ::1, *)"
            style={{ padding: '8px', width: '300px', marginLeft: '10px', minHeight: '60px' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          IP to Test:
          <input
            type="text"
            value={ipToTest}
            onChange={e => setIpToTest(e.target.value)}
            placeholder="Enter IP to test (e.g., 192.168.1.1 or ::ffff:192.168.1.1)"
            style={{ padding: '8px', width: '300px', marginLeft: '50px' }}
          />
        </label>
      </div>
      <button
        onClick={handleTest}
        style={{ padding: '8px 16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        Test
      </button>
      {result && <p style={{ marginTop: '10px' }}>{result}</p>}
    </div>
  );
};

export default IPFilterTester;
