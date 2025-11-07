import React, { useState } from 'react';

const RegexTester = () => {
  const [regexPattern, setRegexPattern] = useState('.*\\.csv');
  const [testString, setTestString] = useState('example.csv');
  const [result, setResult] = useState(null);

  const handleTest = () => {
    try {
      const pattern = new RegExp(regexPattern);
      const isMatch = pattern.test(testString);
      setResult(isMatch ? '✅ Pattern matches the filename.' : '❌ Pattern does NOT match the filename.');
    } catch (e) {
      setResult(`❌ Invalid regex: ${e.message}`);
    }
  };

  return (
    <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h4>Regex Tester</h4>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Regex Pattern:
          <input
            type="text"
            value={regexPattern}
            onChange={e => setRegexPattern(e.target.value)}
            placeholder="Enter regex pattern (e.g., .*\.csv)"
            style={{ padding: '8px', width: '300px', marginLeft: '20px' }}
          />
        </label>
      </div>
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>
          Filename to Test:
          <input
            type="text"
            value={testString}
            onChange={e => setTestString(e.target.value)}
            placeholder="Enter filename to test (e.g., data.csv)"
            style={{ padding: '8px', width: '300px', marginLeft: '10px' }}
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

      <div style={{ marginTop: '15px', fontSize: '0.9em', color: '#666' }}>
        <h5>Common Examples:</h5>
        <ul style={{ margin: '5px 0 5px 20px', padding: 0 }}>
          <li>
            <code>.*</code> → All files
          </li>
          <li>
            <code>.*\.txt</code> → Text files
          </li>
          <li>
            <code>.*\.csv</code> → CSV files
          </li>
          <li>
            <code>.*\.csv|.*\.xlsx</code> → CSV or Excel files
          </li>
          <li>
            <code>data_.*\.json</code> → JSON files starting with "data_"
          </li>
        </ul>
      </div>
    </div>
  );
};

export default RegexTester;
