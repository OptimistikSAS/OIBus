import SouthModbus from './south-modbus';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';

jest.mock('node:fs/promises');
jest.mock('node:net');
jest.mock('jsmodbus', () => ({
  client: {
    TCP: jest.fn()
  }
}));
jest.mock('../../service/utils');
const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        southCacheRepository: {
          database
        }
      };
    }
);

const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const items: Array<OibusItemDTO> = [
  {
    id: 'id1',
    name: 'HoldingRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'holdingRegister',
      dataType: 'UInt16',
      address: '0x4E80',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'HoldingRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'holdingRegister',
      dataType: 'UInt16',
      address: '20097',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'HoldingRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'inputRegister',
      dataType: 'UInt16',
      address: '0x3E81',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'HoldingRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'discreteInput',
      dataType: 'UInt16',
      address: '0x1E82',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'HoldingRegister',
    connectorId: 'southId',
    settings: {
      modbusType: 'coil',
      dataType: 'UInt16',
      address: '0x0E83',
      multiplierCoefficient: 1
    },
    scanModeId: 'scanModeId1'
  }
];

let south: SouthModbus;
const configuration: SouthConnectorDTO = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  settings: {
    port: 502,
    host: '127.0.0.1',
    slaveId: 1,
    addressOffset: 'Modbus',
    endianness: 'Big Endian',
    swapBytesInWords: false,
    swapWordsInDWords: false,
    retryInterval: 10000
  }
};

describe('SouthModbus', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    south = new SouthModbus(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
    );
  });

  it('should retrieve number of words', () => {
    expect(south.getNumberOfWords('UInt16')).toEqual(1);
    expect(south.getNumberOfWords('Int16')).toEqual(1);
    expect(south.getNumberOfWords('UInt32')).toEqual(2);
    expect(south.getNumberOfWords('Int32')).toEqual(2);
    expect(south.getNumberOfWords('Float')).toEqual(2);
    expect(south.getNumberOfWords('BigUInt64')).toEqual(4);
    expect(south.getNumberOfWords('BigInt64')).toEqual(4);
    expect(south.getNumberOfWords('Double')).toEqual(4);
    expect(south.getNumberOfWords('other')).toEqual(1);
  });
});
