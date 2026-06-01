import { useState } from 'react';
import PropTypes from 'prop-types';

// ── Data ──────────────────────────────────────────────────────────────────────

const TOPICS = [
  'factory/line1/temperature',
  'factory/line1/pressure',
  'factory/line2/temperature',
  'factory/line2/pressure',
  'factory/line2/humidity',
  'alerts/line1/overheat',
  'alerts/line2/overheat'
];

const PRESETS = [
  { label: 'factory/#', hint: 'all factory topics' },
  { label: 'factory/+/temperature', hint: 'temperature from any line' },
  { label: 'factory/line1/#', hint: 'all line1 sensors' },
  { label: '+/line2/+', hint: 'any root → line2 → any leaf' },
  { label: 'alerts/#', hint: 'all alerts' },
  { label: '#', hint: 'everything' }
];

// ── MQTT wildcard matching ────────────────────────────────────────────────────

function matchesTopic(filter, topic) {
  if (!filter) return false;
  const fp = filter.split('/');
  const tp = topic.split('/');

  function go(fi, ti) {
    if (fp[fi] === '#') return true;
    if (fi === fp.length && ti === tp.length) return true;
    if (fi >= fp.length || ti >= tp.length) return false;
    if (fp[fi] === '+' || fp[fi] === tp[ti]) return go(fi + 1, ti + 1);
    return false;
  }

  return go(0, 0);
}

// ── Topic tree builder ────────────────────────────────────────────────────────

function buildTree(topics) {
  const root = {};
  for (const topic of topics) {
    const parts = topic.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!cur[p]) cur[p] = { children: {}, fullTopic: null };
      if (i === parts.length - 1) cur[p].fullTopic = topic;
      cur = cur[p].children;
    }
  }
  return root;
}

const TREE = buildTree(TOPICS);

// ── Styles ────────────────────────────────────────────────────────────────────

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

// ── Tree node ─────────────────────────────────────────────────────────────────

function TreeNode({ segment, node, depth, filter }) {
  const isLeaf = node.fullTopic !== null;
  const matched = isLeaf && filter !== '' && matchesTopic(filter, node.fullTopic);
  const dimmed = isLeaf && filter !== '' && !matched;
  const children = Object.entries(node.children);

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : '1.5rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.2rem 0.4rem',
          borderRadius: '4px',
          marginBottom: '0.08rem',
          backgroundColor: matched ? 'var(--ifm-color-success-contrast-background)' : 'transparent',
          opacity: dimmed ? 0.28 : 1,
          transition: 'opacity 0.12s ease, background-color 0.12s ease',
          fontFamily: 'var(--ifm-font-family-monospace)',
          fontSize: '0.875rem',
          color: matched ? 'var(--ifm-color-success-darkest)' : isLeaf ? 'var(--ifm-font-color-base)' : 'var(--ifm-color-emphasis-700)'
        }}
      >
        <span
          style={{
            userSelect: 'none',
            fontSize: '0.72rem',
            color: 'var(--ifm-color-emphasis-400)'
          }}
        >
          {isLeaf ? '○' : '▸'}
        </span>
        <span style={{ fontWeight: isLeaf ? 400 : 700 }}>
          {segment}
          {!isLeaf ? '/' : ''}
        </span>
        {matched && <span style={{ marginLeft: 'auto', fontSize: '0.8rem' }}>✅</span>}
      </div>
      {children.map(([seg, child]) => (
        <TreeNode key={seg} segment={seg} node={child} depth={depth + 1} filter={filter} />
      ))}
    </div>
  );
}

const nodeShape = PropTypes.shape({
  fullTopic: PropTypes.string,
  children: PropTypes.objectOf(PropTypes.object)
});

TreeNode.propTypes = {
  segment: PropTypes.string.isRequired,
  node: nodeShape.isRequired,
  depth: PropTypes.number.isRequired,
  filter: PropTypes.string.isRequired
};

// ── Main component ────────────────────────────────────────────────────────────

const MqttWildcardTester = () => {
  const [filter, setFilter] = useState('factory/#');

  const matchCount = filter ? TOPICS.filter(t => matchesTopic(filter, t)).length : 0;
  const hasFilter = filter.trim() !== '';

  return (
    <div style={card}>
      {/* ── Filter input ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={fieldLabel}>
          Subscription filter{' '}
          <span style={fieldHint}>
            (<code>+</code> single level &nbsp;·&nbsp; <code>#</code> multi-level)
          </span>
        </label>
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="e.g. factory/#"
          style={{
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
          }}
        />
      </div>

      {/* ── Topic tree ── */}
      <div
        style={{
          padding: '1rem 1.1rem',
          border: '1px solid var(--ifm-color-emphasis-200)',
          borderRadius: 'var(--ifm-global-radius)',
          backgroundColor: 'var(--ifm-background-color)',
          marginBottom: '1rem'
        }}
      >
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--ifm-color-emphasis-600)',
            marginBottom: '0.75rem'
          }}
        >
          Topic tree
        </div>
        {Object.entries(TREE).map(([seg, node]) => (
          <TreeNode key={seg} segment={seg} node={node} depth={0} filter={filter} />
        ))}
      </div>

      {/* ── Result banner ── */}
      <div
        style={{
          padding: '0.65rem 1rem',
          marginBottom: '1.25rem',
          border: `1px solid ${hasFilter && matchCount > 0 ? 'var(--ifm-color-success-dark)' : 'var(--ifm-color-emphasis-300)'}`,
          borderRadius: 'var(--ifm-global-radius)',
          backgroundColor: hasFilter && matchCount > 0 ? 'var(--ifm-color-success-contrast-background)' : 'var(--ifm-background-color)',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: hasFilter && matchCount > 0 ? 'var(--ifm-color-success-darkest)' : 'var(--ifm-color-emphasis-600)',
          transition: 'all 0.12s ease'
        }}
      >
        {hasFilter ? `${matchCount} of ${TOPICS.length} topics matched` : 'Enter a subscription filter above'}
      </div>

      {/* ── Presets ── */}
      <div
        style={{
          paddingTop: '1rem',
          borderTop: '1px solid var(--ifm-color-emphasis-200)'
        }}
      >
        <p
          style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.8rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ifm-color-emphasis-700)'
          }}
        >
          Examples
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setFilter(p.label)}
              title={p.hint}
              style={{
                padding: '0.2rem 0.75rem',
                border: '1px solid var(--ifm-color-emphasis-300)',
                borderRadius: 'var(--ifm-global-radius)',
                backgroundColor: 'var(--ifm-background-color)',
                color: 'var(--ifm-font-color-base)',
                fontFamily: 'var(--ifm-font-family-monospace)',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {p.label} <span style={{ opacity: 0.55, fontSize: '0.75rem' }}>{p.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MqttWildcardTester;
