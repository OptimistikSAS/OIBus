import React, { useState } from 'react';
import cronstrue from 'cronstrue';

const CronTester = () => {
  const [cronExpression, setCronExpression] = useState('');
  const [description, setDescription] = useState('');
  const [nextRuns, setNextRuns] = useState([]);

  const parseCron = expr => {
    try {
      const desc = cronstrue.toString(expr);
      setDescription(desc);
      // Simulate next runs (for demo purposes)
      const runs = [
        new Date(Date.now() + 1000).toLocaleString(),
        new Date(Date.now() + 2000).toLocaleString(),
        new Date(Date.now() + 3000).toLocaleString()
      ];
      setNextRuns(runs);
    } catch {
      setDescription('Invalid Cron expression');
      setNextRuns([]);
    }
  };

  const handleChange = e => {
    setCronExpression(e.target.value);
    parseCron(e.target.value);
  };

  return (
    <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h4>Cron Expression Tester</h4>
      <input
        type="text"
        value={cronExpression}
        onChange={handleChange}
        placeholder="Enter Cron expression (e.g., * * * * * *)"
        style={{ padding: '8px', width: '300px', marginRight: '10px' }}
      />
      <div style={{ marginTop: '10px' }}>
        <p>
          <strong>Description:</strong> {description}
        </p>
        <p>
          <strong>Next runs (simulated):</strong>
        </p>
        <ul>
          {nextRuns.map((run, i) => (
            <li key={i}>{run}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CronTester;
