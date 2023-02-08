import fs from 'node:fs/promises';
import path from 'node:path';

import PinoLogger from '../tests/__mocks__/logger.mock';

import CertificateService from './certificate.service';
import pino from 'pino';

jest.mock('node:fs/promises');

const keyFilePath = 'myKeyFile';
const certFilePath = 'myCertFile';
const caFilePath = 'myCAFile';
let certificateService: CertificateService;

const logger: pino.Logger = new PinoLogger();
describe('Certificate service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    certificateService = new CertificateService(logger);
  });

  it('should properly initialized certificate service', async () => {
    await certificateService.init({});
    expect(fs.readFile).toHaveBeenCalledTimes(0);

    await certificateService.init({ privateKeyFilePath: keyFilePath, certFilePath: certFilePath, caFilePath: caFilePath });
    expect(fs.readFile).toHaveBeenCalledTimes(3);
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(keyFilePath));
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(certFilePath));
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(caFilePath));
  });

  it('should properly log errors', async () => {
    (fs.readFile as jest.Mock).mockImplementation(() => {
      throw new Error('read error');
    });

    await certificateService.init({ privateKeyFilePath: keyFilePath, certFilePath: certFilePath, caFilePath: caFilePath });
    expect(logger.error).toHaveBeenCalledTimes(3);
    expect(logger.error).toHaveBeenCalledWith(`Key file "${keyFilePath}" does not exist: Error: read error`);
    expect(logger.error).toHaveBeenCalledWith(`Cert file "${certFilePath}" does not exist: Error: read error`);
    expect(logger.error).toHaveBeenCalledWith(`CA file "${caFilePath}" does not exist: Error: read error`);
  });
});
