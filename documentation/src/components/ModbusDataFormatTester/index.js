import React, { useState } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────

const DATA_TYPES = ['UInt16', 'Int16', 'UInt32', 'Int32', 'Float', 'Double'];

const REGISTER_COUNT = {
  UInt16: 1,
  Int16: 1,
  UInt32: 2,
  Int32: 2,
  Float: 2,
  Double: 4
};

// Eight visually distinct colors — each original byte keeps its color throughout the pipeline
const BYTE_COLORS = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7'];

const PRESETS = [
  { label: '10.0', dataType: 'Float', registers: ['4120', '0000', '0000', '0000'] },
  { label: 'π', dataType: 'Float', registers: ['4049', '0FDB', '0000', '0000'] },
  { label: '-1', dataType: 'Int32', registers: ['FFFF', 'FFFF', '0000', '0000'] },
  { label: '65535', dataType: 'UInt16', registers: ['FFFF', '0000', '0000', '0000'] }
];

// ── Pure helpers ─────────────────────────────────────────────────────────────

function parseReg(str) {
  const v = parseInt(str, 16);
  return isNaN(v) ? 0 : v & 0xffff;
}

/** Extract raw bytes from registers, respecting endianness setting. */
function extractBytes(registers, bigEndian) {
  const bytes = [];
  for (const reg of registers) {
    const high = (reg >> 8) & 0xff;
    const low = reg & 0xff;
    bigEndian ? bytes.push(high, low) : bytes.push(low, high);
  }
  return bytes;
}

/** Swap bytes within each 16-bit word of a byteMap (in-place copy). */
function doSwapBytes(map) {
  const r = [...map];
  for (let i = 0; i + 1 < r.length; i += 2) [r[i], r[i + 1]] = [r[i + 1], r[i]];
  return r;
}

/** Swap adjacent 16-bit word pairs within each 32-bit group. */
function doSwapWords(map) {
  const r = [...map];
  for (let i = 0; i + 3 < r.length; i += 4) [r[i], r[i + 1], r[i + 2], r[i + 3]] = [r[i + 2], r[i + 3], r[i], r[i + 1]];
  return r;
}

/** Interpret the final byte array as the chosen data type (always Big Endian at this point). */
function interpretBytes(bytes, dataType) {
  try {
    const buf = new ArrayBuffer(bytes.length);
    const view = new DataView(buf);
    bytes.forEach((b, i) => view.setUint8(i, b));
    switch (dataType) {
      case 'UInt16':
        return view.getUint16(0, false);
      case 'Int16':
        return view.getInt16(0, false);
      case 'UInt32':
        return view.getUint32(0, false);
      case 'Int32':
        return view.getInt32(0, false);
      case 'Float': {
        const v = view.getFloat32(0, false);
        return isFinite(v) ? parseFloat(v.toPrecision(7)) : String(v);
      }
      case 'Double': {
        const v = view.getFloat64(0, false);
        return isFinite(v) ? parseFloat(v.toPrecision(15)) : String(v);
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

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

const selectStyle = {
  padding: '0.4rem 0.6rem',
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 'var(--ifm-global-radius)',
  backgroundColor: 'var(--ifm-background-color)',
  color: 'var(--ifm-font-color-base)',
  fontSize: '0.875rem',
  cursor: 'pointer'
};

// ── Sub-components ────────────────────────────────────────────────────────────

const ByteChip = ({ value, color }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2.6rem',
      height: '2.6rem',
      borderRadius: '6px',
      backgroundColor: color,
      color: '#fff',
      fontFamily: 'var(--ifm-font-family-monospace)',
      fontSize: '0.85rem',
      fontWeight: 700,
      userSelect: 'none',
      flexShrink: 0
    }}
  >
    {value.toString(16).padStart(2, '0').toUpperCase()}
  </span>
);

const Toggle = ({ label, checked, onChange, disabled }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      fontSize: '0.875rem',
      color: disabled ? 'var(--ifm-color-emphasis-400)' : 'var(--ifm-font-color-base)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      userSelect: 'none'
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      disabled={disabled}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', width: '1rem', height: '1rem' }}
    />
    {label}
  </label>
);

const RegInput = ({ label, value, onChange }) => {
  const valid = /^[0-9a-fA-F]{0,4}$/.test(value);
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--ifm-color-emphasis-600)', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <span
          style={{
            fontFamily: 'var(--ifm-font-family-monospace)',
            fontSize: '0.875rem',
            color: 'var(--ifm-color-emphasis-500)'
          }}
        >
          0x
        </span>
        <input
          type="text"
          value={value}
          maxLength={4}
          onChange={e => onChange(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 4))}
          style={{
            width: '5rem',
            padding: '0.4rem 0.5rem',
            border: `1px solid ${valid ? 'var(--ifm-color-emphasis-300)' : 'var(--ifm-color-danger)'}`,
            borderRadius: 'var(--ifm-global-radius)',
            fontFamily: 'var(--ifm-font-family-monospace)',
            fontSize: '0.875rem',
            backgroundColor: 'var(--ifm-background-color)',
            color: 'var(--ifm-font-color-base)',
            textTransform: 'uppercase',
            outline: 'none',
            boxSizing: 'border-box'
          }}
          placeholder="0000"
        />
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const ModbusDataFormatTester = () => {
  const [dataType, setDataType] = useState('Float');
  const [regHex, setRegHex] = useState(['4120', '0000', '0000', '0000']);
  const [bigEndian, setBigEndian] = useState(true);
  const [swapBytes, setSwapBytes] = useState(false);
  const [swapWords, setSwapWords] = useState(false);

  const regCount = REGISTER_COUNT[dataType];
  const activeRegs = regHex.slice(0, regCount).map(parseReg);

  // ── Byte pipeline ──
  const rawBytes = extractBytes(activeRegs, bigEndian);
  let byteMap = rawBytes.map((value, i) => ({ value, originalIdx: i }));
  if (swapBytes) byteMap = doSwapBytes(byteMap);
  if (swapWords && regCount > 1) byteMap = doSwapWords(byteMap);

  const finalBytes = byteMap.map(b => b.value);
  const value = interpretBytes(finalBytes, dataType);
  const isTransformed = rawBytes.some((b, i) => b !== finalBytes[i]);

  const transformLabel = [swapBytes && 'swap bytes', swapWords && regCount > 1 && 'swap words'].filter(Boolean).join(' + ');

  // ── Handlers ──
  const updateReg = (i, val) => {
    const n = [...regHex];
    n[i] = val;
    setRegHex(n);
  };

  const applyPreset = p => {
    setDataType(p.dataType);
    setRegHex([...p.registers]);
    setBigEndian(true);
    setSwapBytes(false);
    setSwapWords(false);
  };

  // ── Render ──
  return (
    <div style={card}>
      {/* ── Controls row ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'flex-end', marginBottom: '1.25rem' }}>
        <div>
          <label style={fieldLabel}>Data Type</label>
          <select value={dataType} onChange={e => setDataType(e.target.value)} style={selectStyle}>
            {DATA_TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={fieldLabel}>Endianness</label>
          <select value={bigEndian ? 'big' : 'little'} onChange={e => setBigEndian(e.target.value === 'big')} style={selectStyle}>
            <option value="big">Big Endian</option>
            <option value="little">Little Endian</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '1rem', paddingBottom: '0.15rem' }}>
          <Toggle label="Swap Bytes" checked={swapBytes} onChange={setSwapBytes} />
          <Toggle label="Swap Words" checked={swapWords} onChange={setSwapWords} disabled={regCount < 2} />
        </div>
      </div>

      {/* ── Register inputs ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={fieldLabel}>
          Registers <span style={fieldHint}>({regCount} × 16-bit, hex)</span>
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {Array.from({ length: regCount }).map((_, i) => (
            <RegInput key={i} label={`Register ${i + 1}`} value={regHex[i] ?? '0000'} onChange={v => updateReg(i, v)} />
          ))}
        </div>
      </div>

      {/* ── Byte pipeline visualization ── */}
      <div
        style={{
          padding: '1rem 1.1rem',
          border: '1px solid var(--ifm-color-emphasis-200)',
          borderRadius: 'var(--ifm-global-radius)',
          backgroundColor: 'var(--ifm-background-color)',
          marginBottom: '1rem'
        }}
      >
        {/* Section title */}
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
          Byte pipeline
        </div>

        {/* Raw bytes — grouped by register */}
        <div style={{ marginBottom: isTransformed ? 0 : 0 }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--ifm-color-emphasis-500)',
              marginBottom: '0.4rem'
            }}
          >
            From registers{bigEndian ? ' (Big Endian)' : ' (Little Endian)'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
            {Array.from({ length: regCount }).map((_, regIdx) => (
              <div key={regIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <div style={{ display: 'flex', gap: '0.3rem' }}>
                  {[0, 1].map(bi => {
                    const idx = regIdx * 2 + bi;
                    return <ByteChip key={bi} value={rawBytes[idx]} color={BYTE_COLORS[idx]} />;
                  })}
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--ifm-color-emphasis-500)' }}>R{regIdx + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow + transformed bytes */}
        {isTransformed && (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: '0.75rem 0',
                color: 'var(--ifm-color-emphasis-500)',
                fontSize: '0.8rem'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>↓</span>
              <span>{transformLabel}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {byteMap.map((b, i) => (
                <ByteChip key={i} value={b.value} color={BYTE_COLORS[b.originalIdx]} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Result ── */}
      <div
        style={{
          padding: '0.75rem 1rem',
          border: '1px solid var(--ifm-color-success-dark)',
          borderRadius: 'var(--ifm-global-radius)',
          backgroundColor: 'var(--ifm-color-success-contrast-background)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.75rem'
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--ifm-color-emphasis-600)'
          }}
        >
          {dataType}
        </span>
        <span
          style={{
            fontFamily: 'var(--ifm-font-family-monospace)',
            fontSize: '1.3rem',
            fontWeight: 700,
            color: 'var(--ifm-color-success-darkest)'
          }}
        >
          {value !== null ? String(value) : '–'}
        </span>
      </div>

      {/* ── Presets ── */}
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
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--ifm-color-emphasis-700)'
          }}
        >
          Presets
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
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
              {p.label} <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{p.dataType}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModbusDataFormatTester;
