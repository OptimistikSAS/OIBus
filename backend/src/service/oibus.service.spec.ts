import OIBusService from './oibus.service';
import os from 'node:os';

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
      version: '3.0'
    };
    const result = service.getOIBusInfo();
    expect(result).toEqual(expectedResult);
  });
});
