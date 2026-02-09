import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { encryptionService } from '../../service/encryption.service';
import NorthSftp from './north-sftp';
import CacheServiceMock from '../../tests/__mocks__/service/cache/cache-service.mock';
import { NorthSFTPSettings } from '../../../shared/model/north-settings.model';
import sftpClient from 'ssh2-sftp-client';
import { NorthConnectorEntity } from '../../model/north-connector.model';
import testData from '../../tests/utils/test-data';
import CacheService from '../../service/cache/cache.service';
import { createTransformer } from '../../service/transformer.service';
import OIBusTransformer from '../../transformers/oibus-transformer';
import OIBusTransformerMock from '../../tests/__mocks__/service/transformers/oibus-transformer.mock';
import fs from 'node:fs/promises';
import { ReadStream } from 'node:fs';
import { buildNorthConfiguration } from '../../tests/utils/test-utils';

// Mock dependencies
jest.mock('node:fs/promises');
jest.mock('ssh2-sftp-client');
jest.mock('../../service/utils');
jest.mock('../../service/transformer.service');
jest.mock('../../service/encryption.service', () => ({
  encryptionService: new EncryptionServiceMock('', '')
}));

const logger: pino.Logger = new PinoLogger();
const cacheService: CacheService = new CacheServiceMock();
const oiBusTransformer: OIBusTransformer = new OIBusTransformerMock() as unknown as OIBusTransformer;

jest.mock(
  '../../service/cache/cache.service',
  () =>
    function () {
      return cacheService;
    }
);

const mockSftpClient = {
  connect: jest.fn(),
  list: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  end: jest.fn(),
  exists: jest.fn()
};

let configuration: NorthConnectorEntity<NorthSFTPSettings>;
let north: NorthSftp;

describe('NorthSFTP', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = buildNorthConfiguration<NorthSFTPSettings>('sftp', {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'password',
      username: 'user',
      password: 'pass',
      prefix: 'prefix_',
      suffix: '_suffix'
    });
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    // Default mock for readFile (used in private key auth, but safe to mock globally)
    (fs.readFile as jest.Mock).mockResolvedValue('private-key-content');

    north = new NorthSftp(configuration, logger, cacheService);
    await north.start();
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should retrieve supported types', () => {
    expect(north.supportedTypes()).toEqual(['any']);
  });

  it('should properly handle files and call sendToSftpServer', async () => {
    const sendSpy = jest.spyOn(north, 'sendToSftpServer').mockResolvedValue(undefined);
    const mockStream = {} as ReadStream;

    // Logic: prefix + name + suffix + ext
    // contentFile: 'path/to/file/example-123.file' -> name='example-123', ext='.file'
    // prefix='prefix_', suffix='_suffix'
    const expectedFileName = `prefix_example-123_suffix.file`;
    const expectedTarget = `remoteFolder/${expectedFileName}`;

    await north.handleContent(mockStream, {
      contentFile: 'path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(sendSpy).toHaveBeenCalledWith(mockStream, expectedTarget);
  });

  it('should properly catch handle file error', async () => {
    jest.spyOn(north, 'sendToSftpServer').mockRejectedValue(new Error('Error handling files'));
    const mockStream = {} as ReadStream;

    await expect(
      north.handleContent(mockStream, {
        contentFile: 'path/to/file/example-123.file',
        contentSize: 1234,
        numberOfElement: 1,
        createdAt: '2020-02-02T02:02:02.222Z',
        contentType: 'any'
      })
    ).rejects.toThrow('Error handling files');
  });

  it('should send content into SFTP server (Password Auth)', async () => {
    const mockStream = {} as ReadStream;
    await north.sendToSftpServer(mockStream, 'remoteFolder/target');

    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.put).toHaveBeenCalledWith(mockStream, 'remoteFolder/target');
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
    expect(encryptionService.decryptText).toHaveBeenCalledWith('pass');
  });

  it('should send content into SFTP server without user and password', async () => {
    configuration.settings.username = '';
    configuration.settings.password = null;
    const mockStream = {} as ReadStream;

    await north.sendToSftpServer(mockStream, 'remoteFolder/target');

    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.put).toHaveBeenCalledWith(mockStream, 'remoteFolder/target');
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
    expect(encryptionService.decryptText).not.toHaveBeenCalled();
  });
});

describe('NorthSFTP without suffix or prefix (Private Key Auth)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    configuration = JSON.parse(JSON.stringify(testData.north.list[0]));
    configuration.settings = {
      host: '127.0.0.1',
      port: 2222,
      remoteFolder: 'remoteFolder',
      authentication: 'private-key',
      username: 'user',
      privateKey: 'path/to/private.key',
      passphrase: 'myPassphrase',
      prefix: '',
      suffix: ''
    };
    (sftpClient as jest.Mock).mockImplementation(() => mockSftpClient);
    (createTransformer as jest.Mock).mockImplementation(() => oiBusTransformer);
    (fs.readFile as jest.Mock).mockResolvedValue('actual-private-key-content');

    north = new NorthSftp(configuration, logger, cacheService);
  });

  afterEach(() => {
    cacheService.cacheSizeEventEmitter.removeAllListeners();
  });

  it('should properly handle files (Direct Naming)', async () => {
    const sendSpy = jest.spyOn(north, 'sendToSftpServer').mockResolvedValue(undefined);
    const mockStream = {} as ReadStream;

    // name: example-123, ext: .file
    // prefix: '', suffix: '' -> example-123.file
    await north.handleContent(mockStream, {
      contentFile: 'path/to/file/example-123.file',
      contentSize: 1234,
      numberOfElement: 1,
      createdAt: '2020-02-02T02:02:02.222Z',
      contentType: 'any'
    });

    expect(sendSpy).toHaveBeenCalledWith(mockStream, 'remoteFolder/example-123.file');
  });

  it('should use private key for connection', async () => {
    const mockStream = {} as ReadStream;
    await north.sendToSftpServer(mockStream, 'target');

    expect(fs.readFile).toHaveBeenCalledWith('path/to/private.key', 'utf8');
    expect(encryptionService.decryptText).toHaveBeenCalledWith('myPassphrase');

    expect(mockSftpClient.connect).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'user',
        privateKey: 'actual-private-key-content',
        passphrase: 'myPassphrase' // decrypted value mocked usually returns input in default mock
      })
    );
  });

  // --- Test Connection ---

  it('should have access to output folder', async () => {
    mockSftpClient.exists = jest.fn().mockReturnValueOnce('d'); // 'd' = directory

    await expect(north.testConnection()).resolves.not.toThrow();

    expect(mockSftpClient.connect).toHaveBeenCalledTimes(1);
    expect(mockSftpClient.exists).toHaveBeenCalledWith('remoteFolder');
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if no access', async () => {
    mockSftpClient.exists = jest.fn().mockReturnValueOnce(false); // false = doesn't exist

    await expect(north.testConnection()).rejects.toThrow(/Remote target .* does not exist/);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if it is a file', async () => {
    mockSftpClient.exists = jest.fn().mockReturnValueOnce('-'); // '-' = file

    await expect(north.testConnection()).rejects.toThrow(/is not a folder/);
    expect(mockSftpClient.end).toHaveBeenCalledTimes(1);
  });

  it('should handle SFTP error', async () => {
    mockSftpClient.exists = jest.fn().mockImplementationOnce(() => {
      throw new Error('sftp error');
    });

    await expect(north.testConnection()).rejects.toThrow(/Access error on .* sftp error/);

    // Note: Implementation doesn't call end() in catch block
    expect(mockSftpClient.end).not.toHaveBeenCalled();
  });
});
