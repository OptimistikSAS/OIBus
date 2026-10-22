/**
 * Converts a value to write into a Modbus coil (boolean) or register (integer, decimals are dropped).
 * Booleans, numbers and their string forms ("true", "false", "1", "0", "12.5"...) are accepted.
 * Returns null when the value cannot be converted (e.g. a non-numeric string).
 */
export const toModbusValue = (value: unknown, modbusType: string): number | boolean | null => {
  const parsedValue = parseModbusValue(value);
  if (typeof parsedValue === 'boolean') {
    return modbusType === 'coil' ? parsedValue : Number(parsedValue);
  }
  if (!Number.isFinite(parsedValue)) {
    return null;
  }
  return modbusType === 'coil' ? parsedValue !== 0 : Math.trunc(parsedValue);
};

const parseModbusValue = (value: unknown): number | boolean => {
  if (typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  const text = String(value).trim().toLowerCase();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text === '' ? NaN : Number(text);
};
