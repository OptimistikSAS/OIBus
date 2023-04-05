import OIBusService from './oibus.service';
import os from 'node:os';
import { version } from '../../package.json';

let service: OIBusService;
describe('OIBus service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service = new OIBusService();
  });

  it('should get OIBus info', () => {
    const expectedResult = {
      architecture: process.arch,
      binaryDirectory: process.execPath,
      dataDirectory: process.cwd(),
      hostname: os.hostname(),
      operatingSystem: `${os.type()} ${os.release()}`,
      processId: process.pid.toString(),
      version: version
    };
    const result = service.getOIBusInfo();
    expect(result).toEqual(expectedResult);
  });
});
