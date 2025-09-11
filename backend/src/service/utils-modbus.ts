import { SouthModbusItemSettingsDataDataType, SouthModbusSettingsEndianness } from '../../shared/model/south-settings.model';
import ModbusTCPClient from 'jsmodbus/dist/modbus-tcp-client';

export const readCoil = async (client: ModbusTCPClient, address: number): Promise<string> => {
  const { response } = await client.readCoils(address, 1);
  return response.body.valuesAsArray[0].toString();
};

export const readDiscreteInputRegister = async (client: ModbusTCPClient, address: number): Promise<string> => {
  const { response } = await client.readDiscreteInputs(address, 1);
  return response.body.valuesAsArray[0].toString();
};

export const readInputRegister = async (
  client: ModbusTCPClient,
  address: number,
  swapWordsInDWords: boolean,
  swapBytesInWords: boolean,
  endianness: SouthModbusSettingsEndianness,
  multiplier: number,
  dataType: SouthModbusItemSettingsDataDataType,
  bitIndex: number | undefined
): Promise<string> => {
  const numberOfWords = getNumberOfWords(dataType);
  const { response } = await client.readInputRegisters(address, numberOfWords);
  return getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType, swapWordsInDWords, swapBytesInWords, endianness, bitIndex);
};

export const readHoldingRegister = async (
  client: ModbusTCPClient,
  address: number,
  swapWordsInDWords: boolean,
  swapBytesInWords: boolean,
  endianness: SouthModbusSettingsEndianness,
  multiplier: number,
  dataType: SouthModbusItemSettingsDataDataType,
  bitIndex: number | undefined
): Promise<string> => {
  const numberOfWords = getNumberOfWords(dataType);
  const { response } = await client.readHoldingRegisters(address, numberOfWords);
  return getValueFromBuffer(response.body.valuesAsBuffer, multiplier, dataType, swapWordsInDWords, swapBytesInWords, endianness, bitIndex);
};

/**
 * Retrieve a value from buffer with appropriate conversion according to the modbus settings
 */
export const getValueFromBuffer = (
  buffer: Buffer,
  multiplier: number,
  dataType: SouthModbusItemSettingsDataDataType,
  swapWordsInDWords: boolean,
  swapBytesInWords: boolean,
  endianness: SouthModbusSettingsEndianness,
  bitIndex: number | undefined
): string => {
  if (!['bit', 'int16', 'uint16'].includes(dataType)) {
    buffer.swap32().swap16();
    if (swapWordsInDWords) {
      buffer.swap16().swap32();
    }
    if (swapBytesInWords) {
      buffer.swap16();
    }

    const bufferValue = readBuffer(buffer, dataType, endianness, 0);
    return (parseFloat(bufferValue) * multiplier).toString();
  }

  if (swapBytesInWords) {
    buffer.swap16();
  }

  const bufferValue = readBuffer(buffer, dataType, endianness, bitIndex || 0);
  return (parseFloat(bufferValue) * multiplier).toString();
};

/**
 * Retrieve the right buffer function name according to the data type
 */
export const readBuffer = (
  buffer: Buffer,
  dataType: SouthModbusItemSettingsDataDataType,
  endianness: SouthModbusSettingsEndianness,
  bitIndex: number
): string => {
  const methodSuffix = endianness === 'little-endian' ? 'LE' : 'BE';
  switch (dataType) {
    case 'uint16':
      return buffer[`readUInt16${methodSuffix}`]().toString();
    case 'int16':
      return buffer[`readInt16${methodSuffix}`]().toString();
    case 'uint32':
      return buffer[`readUInt32${methodSuffix}`]().toString();
    case 'int32':
      return buffer[`readInt32${methodSuffix}`]().toString();
    case 'big-uint64':
      return buffer[`readBigUInt64${methodSuffix}`]().toString();
    case 'big-int64':
      return buffer[`readBigInt64${methodSuffix}`]().toString();
    case 'float':
      return buffer[`readFloat${methodSuffix}`]().toString();
    case 'double':
      return buffer[`readDouble${methodSuffix}`]().toString();
    case 'bit':
      return `${(buffer[`readUInt16${methodSuffix}`]() >> bitIndex) & 1}`;
  }
};

/**
 * Retrieve the number of Words in Modbus associated to each data type
 */
export const getNumberOfWords = (dataType: string): number => {
  if (['uint32', 'int32', 'float'].includes(dataType)) {
    return 2;
  }
  if (['big-uint64', 'big-int64', 'double'].includes(dataType)) {
    return 4;
  }
  return 1;
};
