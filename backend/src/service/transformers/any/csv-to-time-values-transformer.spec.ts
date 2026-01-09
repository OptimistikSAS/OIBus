import { Readable } from 'stream';
import pino from 'pino';
import PinoLogger from '../../../tests/__mocks__/service/logger/logger.mock'; // Adjust path
import testData from '../../../tests/utils/test-data'; // Adjust path
import { flushPromises } from '../../../tests/utils/test-utils'; // Adjust path
import CSVToTimeValuesTransformer from './csv-to-time-values-transformer';
import Papa from 'papaparse';

// 1. Mock External Dependencies
jest.mock('papaparse', () => ({
  parse: jest.fn()
}));

jest.mock('../../utils', () => ({
  convertDateTimeToInstant: jest.fn().mockReturnValue(1698400000000), // Fixed timestamp
  convertDelimiter: jest.fn().mockImplementation(delim => (delim === 'SEMI_COLON' ? ';' : ',')),
  generateRandomId: jest.fn().mockReturnValue('fixed-random-id'),
  sanitizeFilename: jest.fn().mockImplementation(name => name)
}));

const logger: pino.Logger = new PinoLogger();

describe('CSVToTimeValuesTransformer', () => {
  let transformer: CSVToTimeValuesTransformer;
  let mockStream: Readable;

  // Default options for "Header Mode"
  const headerOptions = {
    regex: '.*\\.csv',
    filename: 'header-output',
    delimiter: 'SEMI_COLON',
    hasHeader: true,
    pointIdColumn: 'SensorID',
    timestampColumn: 'Time',
    valueColumn: 'Reading',
    timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
  };

  // Default options for "Index Mode"
  const indexOptions = {
    regex: '.*\\.csv',
    filename: 'index-output',
    delimiter: 'COMMA',
    hasHeader: false,
    pointIdColumn: '0',
    timestampColumn: '1',
    valueColumn: '2',
    timestampSettings: { type: 'iso-string', timezone: 'UTC', format: 'yyyy', locale: 'en' }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStream = new Readable();
  });

  // --------------------------------------------------------------------------
  // 1. Header Mode Tests
  // --------------------------------------------------------------------------

  it('should transform valid CSV with headers', async () => {
    // Arrange
    transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], testData.north.list[0], headerOptions);

    // Mock PapaParse success
    (Papa.parse as jest.Mock).mockReturnValue({
      errors: [],
      data: [
        { SensorID: 'S1', Time: '2023-01-01', Reading: 10 },
        { SensorID: 'S2', Time: '2023-01-02', Reading: 20 }
      ]
    });

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('raw-csv-content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Assert
    expect(Papa.parse).toHaveBeenCalledWith('raw-csv-content', expect.objectContaining({ header: true, delimiter: ';' }));
    expect(output).toHaveLength(2);
    expect(output[0].pointId).toBe('S1');
    expect(output[1].data.value).toBe(20);
    expect(result.metadata.contentFile).toBe('fixed-random-id.json');
  });

  // --------------------------------------------------------------------------
  // 2. Index Mode Tests
  // --------------------------------------------------------------------------

  it('should transform valid CSV without headers (using indices)', async () => {
    // Arrange
    transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], testData.north.list[0], indexOptions);

    // Mock PapaParse success (array of arrays)
    (Papa.parse as jest.Mock).mockReturnValue({
      errors: [],
      data: [
        ['S1', '2023-01-01', 10],
        ['S2', '2023-01-02', 20]
      ]
    });

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Assert
    expect(Papa.parse).toHaveBeenCalledWith('content', expect.objectContaining({ header: false, delimiter: ',' }));
    expect(output).toHaveLength(2);
    expect(output[0].pointId).toBe('S1');
    expect(output[1].pointId).toBe('S2');
  });

  // --------------------------------------------------------------------------
  // 3. Validation & Filtering Logic (The "if" checks)
  // --------------------------------------------------------------------------

  it('should skip rows with missing or invalid required fields', async () => {
    // Arrange
    transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], testData.north.list[0], headerOptions);

    (Papa.parse as jest.Mock).mockReturnValue({
      errors: [],
      data: [
        { SensorID: 'Valid', Time: '2023', Reading: 1 }, // Keep
        { SensorID: null, Time: '2023', Reading: 2 }, // Skip (No ID)
        { SensorID: 'NoTS', Time: null, Reading: 3 }, // Skip (No TS)
        { SensorID: 'NoVal', Time: '2023', Reading: null }, // Skip (No Value)
        { SensorID: 'ValidZero', Time: '2023', Reading: 0 } // Keep (0 is valid)
      ]
    });

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Assert
    expect(output).toHaveLength(2);
    expect(output[0].pointId).toBe('Valid');
    expect(output[1].pointId).toBe('ValidZero');
  });

  // --------------------------------------------------------------------------
  // 4. Edge Cases: Invalid Configurations & Errors
  // --------------------------------------------------------------------------

  it('should handle configuration errors for Index Mode (NaN indices)', async () => {
    // Arrange: Config says no header, but columns are strings like "A", "B" (invalid for parseInt)
    const badConfig = { ...indexOptions, pointIdColumn: 'NotANumber' };
    transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], testData.north.list[0], badConfig);

    (Papa.parse as jest.Mock).mockReturnValue({
      errors: [],
      data: [['S1', '2023', 10]]
    });

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('content');
    mockStream.push(null);
    await flushPromises();
    const result = await promise;
    const output = JSON.parse(result.output);

    // Assert
    // extractValue -> parseInt('NotANumber') -> NaN -> returns '' -> Row skipped
    expect(output).toHaveLength(0);
  });

  it('should log warning if PapaParse reports errors', async () => {
    // Arrange
    transformer = new CSVToTimeValuesTransformer(logger, testData.transformers.list[0], testData.north.list[0], headerOptions);

    // Mock Parsing Error
    (Papa.parse as jest.Mock).mockReturnValue({
      errors: [{ message: 'Unclosed quote', row: 0 }],
      data: []
    });

    // Act
    const promise = transformer.transform(mockStream, { source: 'test' }, 'data.csv');
    mockStream.push('bad-csv');
    mockStream.push(null);
    await flushPromises();
    await promise;

    // Assert
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Encountered 1 errors while parsing'));
  });

  // --------------------------------------------------------------------------
  // 5. Manifest
  // --------------------------------------------------------------------------

  it('should correctly expose the manifest settings', () => {
    const manifest = CSVToTimeValuesTransformer.manifestSettings;
    expect(manifest).toBeDefined();
    expect(manifest.key).toBe('options');
    expect(manifest.attributes[0].key).toBe('delimiter');
  });
});
