import { Database } from 'better-sqlite3';
import { emptyDatabase, initDatabase, stripAuditFields } from '../../tests/utils/test-utils';
import testData from '../../tests/utils/test-data';
import { generateRandomId } from '../../service/utils';
import TransformerRepository from './transformer.repository';
import { CustomTransformer, StandardTransformer } from '../../model/transformer.model';
import OIBusTimeValuesToCsvTransformer from '../../transformers/time-values/oibus-time-values-to-csv/oibus-time-values-to-csv-transformer';
import IsoTransformer from '../../transformers/iso-transformer';
import OIBusTimeValuesToJSONTransformer from '../../transformers/time-values/oibus-time-values-to-json/oibus-time-values-to-json-transformer';
import OIBusTimeValuesToMQTTTransformer from '../../transformers/time-values/oibus-time-values-to-mqtt/oibus-time-values-to-mqtt-transformer';
import OIBusTimeValuesToOPCUATransformer from '../../transformers/time-values/oibus-time-values-to-opcua/oibus-time-values-to-opcua-transformer';
import OIBusTimeValuesToModbusTransformer from '../../transformers/time-values/oibus-time-values-to-modbus/oibus-time-values-to-modbus-transformer';
import IgnoreTransformer from '../../transformers/ignore-transformer';
import OIBusSetpointToModbusTransformer from '../../transformers/setpoint/oibus-setpoint-to-modbus/oibus-setpoint-to-modbus-transformer';
import OIBusSetpointToMQTTTransformer from '../../transformers/setpoint/oibus-setpoint-to-mqtt/oibus-setpoint-to-mqtt-transformer';
import OIBusSetpointToOPCUATransformer from '../../transformers/setpoint/oibus-setpoint-to-opcua/oibus-setpoint-to-opcua-transformer';
import OIBusTimeValuesToOIAnalyticsTransformer from '../../transformers/time-values/oibus-time-values-to-oianalytics/oibus-time-values-to-oianalytics-transformer';
import JSONToCSVTransformer from '../../transformers/any/json-to-csv/json-to-csv-transformer';
import CSVToMQTTTransformer from '../../transformers/any/csv-to-mqtt/csv-to-mqtt-transformer';
import CSVToTimeValuesTransformer from '../../transformers/any/csv-to-time-values/csv-to-time-values-transformer';

jest.mock('../../service/utils');

const TEST_DB_PATH = 'src/tests/test-config-transformer.db';

const standardTransformers: Array<StandardTransformer> = [
  { id: 'csvToMqtt', inputType: 'any', functionName: CSVToMQTTTransformer.transformerName, outputType: 'mqtt', type: 'standard' },
  {
    id: 'csvToTimeValues',
    inputType: 'any',
    functionName: CSVToTimeValuesTransformer.transformerName,
    outputType: 'time-values',
    type: 'standard'
  },
  { id: 'ignore', type: 'standard', functionName: IgnoreTransformer.transformerName, inputType: 'any', outputType: 'any' },
  { id: 'iso', type: 'standard', functionName: IsoTransformer.transformerName, inputType: 'any', outputType: 'any' },
  { id: 'jsonToCsv', inputType: 'any', functionName: JSONToCSVTransformer.transformerName, outputType: 'any', type: 'standard' },
  {
    id: 'oibusTimeValuesToCsv',
    type: 'standard',
    functionName: OIBusTimeValuesToCsvTransformer.transformerName,
    inputType: 'time-values',
    outputType: 'any'
  },
  {
    id: 'oibusTimeValuesToJson',
    type: 'standard',
    functionName: OIBusTimeValuesToJSONTransformer.transformerName,
    inputType: 'time-values',
    outputType: 'any'
  },
  {
    id: 'oibusTimeValuesToModbus',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToModbusTransformer.transformerName,
    outputType: 'modbus',
    type: 'standard'
  },
  {
    id: 'oibusTimeValuesToMqtt',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToMQTTTransformer.transformerName,
    outputType: 'mqtt',
    type: 'standard'
  },
  {
    id: 'oibusTimeValuesToOia',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToOIAnalyticsTransformer.transformerName,
    outputType: 'oianalytics',
    type: 'standard'
  },
  {
    id: 'oibusTimeValuesToOpcua',
    inputType: 'time-values',
    functionName: OIBusTimeValuesToOPCUATransformer.transformerName,
    outputType: 'opcua',
    type: 'standard'
  },
  {
    id: 'oibusSetpointToModbus',
    inputType: 'setpoint',
    functionName: OIBusSetpointToModbusTransformer.transformerName,
    outputType: 'modbus',
    type: 'standard'
  },
  {
    id: 'oibusSetpointToMqtt',
    inputType: 'setpoint',
    functionName: OIBusSetpointToMQTTTransformer.transformerName,
    outputType: 'mqtt',
    type: 'standard'
  },
  {
    id: 'oibusSetpointToOpcua',
    inputType: 'setpoint',
    functionName: OIBusSetpointToOPCUATransformer.transformerName,
    outputType: 'opcua',
    type: 'standard'
  }
];

let database: Database;
describe('TransformerRepository', () => {
  beforeAll(async () => {
    const { generateRandomId: realGenerateRandomId } = jest.requireActual('../../service/utils');
    (generateRandomId as jest.Mock).mockImplementation(realGenerateRandomId);
    database = await initDatabase('config', true, TEST_DB_PATH);
    jest.resetAllMocks();
  });

  afterAll(async () => {
    database.close();
    await emptyDatabase('config', TEST_DB_PATH);
  });

  let repository: TransformerRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new TransformerRepository(database);
    jest.resetAllMocks();
  });

  it('should properly find all transformers', () => {
    expect(repository.list().map(stripAuditFields)).toEqual([
      ...standardTransformers.map(({ id: _id, ...rest }) => expect.objectContaining(rest)),
      ...testData.transformers.list.map(stripAuditFields).map(t => expect.objectContaining(t))
    ]);
  });

  it('should properly find a transformer by its ID', () => {
    expect(stripAuditFields(repository.findById(testData.transformers.list[0].id))).toEqual(
      expect.objectContaining(stripAuditFields(testData.transformers.list[0]))
    );
    expect(repository.findById('bad id')).toEqual(null);
  });

  it('should create a transformer', () => {
    repository.delete('newId');
    expect(repository.findById('newId')).toBeNull();

    (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
    const createTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
    createTransformer.id = '';
    createTransformer.name = 'new name';
    repository.save(createTransformer);
    expect(stripAuditFields(repository.findById('newId'))).toEqual(expect.objectContaining(stripAuditFields(createTransformer)));
  });

  it('should update a transformer', () => {
    let existing = repository.findById('newId');
    if (!existing) {
      (generateRandomId as jest.Mock).mockReturnValueOnce('newId');
      const createTransformer = JSON.parse(JSON.stringify(testData.transformers.list[0]));
      createTransformer.id = '';
      createTransformer.name = 'new name';
      repository.save(createTransformer);
      existing = repository.findById('newId');
      if (!existing) {
        throw new Error('Failed to create transformer for update test');
      }
    }
    const updateTransformer = JSON.parse(JSON.stringify(existing));
    updateTransformer.name = 'new name updated';
    updateTransformer.description = 'new description updated';
    repository.save(updateTransformer);
    const result = repository.findById(updateTransformer.id)!;
    expect((result as CustomTransformer).name).toEqual(updateTransformer.name);
    expect((result as CustomTransformer).description).toEqual(updateTransformer.description);
  });

  it('should delete transformer', () => {
    repository.delete('newId');
    expect(repository.findById('newId')).toEqual(null);
  });

  it('should properly search transformers with search params and page them', () => {
    const result = repository.search({
      type: testData.transformers.list[0].type,
      inputType: testData.transformers.list[0].inputType,
      outputType: testData.transformers.list[0].outputType,
      page: 0
    });
    expect(result.totalElements).toEqual(1);
    expect(result.content.map(stripAuditFields)).toEqual([expect.objectContaining(stripAuditFields(testData.transformers.list[0]))]);
  });

  it('should properly search transformers and page them', () => {
    const result = repository.search({ type: undefined, inputType: undefined, outputType: undefined, page: 0 });
    expect(result.totalElements).toEqual(17);
    expect(result.content.map(stripAuditFields)).toEqual(
      standardTransformers.slice(0, 10).map(({ id: _id, ...rest }) => expect.objectContaining(rest))
    );
  });
});
