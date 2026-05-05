import { beforeEach, afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

import EncryptionService, { CERT_FILE_NAME, CERT_PRIVATE_KEY_FILE_NAME, CERT_PUBLIC_KEY_FILE_NAME } from './encryption.service';
import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../shared/model/south-connector.model';
import { SouthOPCUASettings } from '../../shared/model/south-settings.model';
import { OIBusArrayAttribute, OIBusObjectAttribute, OIBusSecretAttribute, OIBusStringAttribute } from '../../shared/model/form.model';
import testData from '../tests/utils/test-data';

const nodeRequire = createRequire(import.meta.url);
const forgeModule = nodeRequire('node-forge');

// Mock certificate object to spy on methods
const mockCert = {
  publicKey: null,
  serialNumber: null,
  validity: {},
  setSubject: mock.fn(),
  setIssuer: mock.fn(),
  setExtensions: mock.fn(),
  sign: mock.fn()
};

const encryptionService = EncryptionService.getInstance();

const cryptoSettings = {
  algorithm: 'aes-256-cbc',
  initVector: Buffer.from('0123456789abcdef').toString('base64'),
  securityKey: Buffer.from('0123456789abcdef').toString('base64')
};

const manifest: OIBusObjectAttribute = {
  type: 'object',
  attributes: [
    {
      key: 'field1',
      type: 'string',
      translationKey: 'Field 1'
    } as OIBusStringAttribute,
    {
      key: 'field2',
      type: 'secret',
      translationKey: 'Field 2'
    } as OIBusSecretAttribute,
    {
      key: 'field3',
      type: 'string',
      translationKey: 'Field 3'
    } as OIBusStringAttribute,
    {
      key: 'field4',
      type: 'array',
      translationKey: 'Field 4',
      paginate: false,
      numberOfElementPerPage: 0,
      rootAttribute: {
        type: 'object',
        attributes: [
          {
            key: 'fieldArray1',
            type: 'string',
            translationKey: 'Field array 1'
          } as OIBusStringAttribute,
          {
            key: 'fieldArray2',
            type: 'secret',
            translationKey: 'Field array 2'
          } as OIBusSecretAttribute,
          {
            key: 'fieldArray3',
            type: 'secret',
            translationKey: 'Field array 3'
          } as OIBusSecretAttribute
        ]
      } as OIBusObjectAttribute
    } as OIBusArrayAttribute,
    {
      key: 'field5',
      type: 'object',
      translationKey: 'Field 5',
      attributes: [
        {
          key: 'fieldGroup1',
          type: 'string',
          translationKey: 'Field group 1'
        } as OIBusStringAttribute,
        {
          key: 'fieldGroup2',
          type: 'secret',
          translationKey: 'Field group 2'
        } as OIBusSecretAttribute
      ]
    } as OIBusObjectAttribute
  ]
} as OIBusObjectAttribute;

const certFolder = 'certFolder';

describe('Encryption Service', () => {
  let statMock: ReturnType<typeof mock.fn>;
  let readFileMock: ReturnType<typeof mock.fn>;
  let writeFileMock: ReturnType<typeof mock.fn>;
  let createCipherivMock: ReturnType<typeof mock.fn>;
  let createDecipherivMock: ReturnType<typeof mock.fn>;
  let privateDecryptMock: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    // Reset service caches between tests
    encryptionService['_certFile'] = null;
    encryptionService['_privateKey'] = null;
    encryptionService['_publicKey'] = null;
    encryptionService['initialized'] = true;

    // Mock fs functions
    statMock = mock.method(fs, 'stat', async () => undefined);
    mock.method(fs, 'mkdir', async () => undefined);
    readFileMock = mock.method(fs, 'readFile', async () => '');
    writeFileMock = mock.method(fs, 'writeFile', async () => undefined);

    // Mock crypto functions
    createCipherivMock = mock.method(crypto, 'createCipheriv', () => ({ update: mock.fn(() => ''), final: mock.fn(() => '') }));
    createDecipherivMock = mock.method(crypto, 'createDecipheriv', () => ({ update: mock.fn(() => ''), final: mock.fn(() => '') }));
    privateDecryptMock = mock.method(crypto, 'privateDecrypt', () => Buffer.from(''));

    // Reset forge mocks
    mockCert.setSubject = mock.fn();
    mockCert.setIssuer = mock.fn();
    mockCert.setExtensions = mock.fn();
    mockCert.sign = mock.fn();

    mock.method(forgeModule.pki.rsa, 'generateKeyPair', () => ({ privateKey: 'MOCK_PRIV_KEY', publicKey: 'MOCK_PUB_KEY' }));
    mock.method(forgeModule.pki, 'createCertificate', () => mockCert);
    mock.method(forgeModule.pki, 'privateKeyToPem', () => '-----BEGIN PRIVATE KEY-----');
    mock.method(forgeModule.pki, 'publicKeyToPem', () => '-----BEGIN PUBLIC KEY-----');
    mock.method(forgeModule.pki, 'certificateToPem', () => '-----BEGIN CERTIFICATE-----');
    mock.method(forgeModule.util, 'bytesToHex', () => 'HEX123');
    mock.method(forgeModule.random, 'getBytesSync', () => 'RANDOM');
    mock.method(forgeModule.md.sha256, 'create', () => 'SHA256_MOCK');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should not create certificate if it already exists', async () => {
    // fs.stat resolves → filesExists returns true, createFolder sees folder as existing
    const generateCertMock = mock.method(encryptionService, 'generateSelfSignedCertificate', mock.fn());

    await encryptionService.init(cryptoSettings, certFolder);

    // Verify createFolder was called (fs.stat called with resolved certFolder path)
    const statCalls = statMock.mock.calls.map(c => c.arguments[0]);
    assert.ok(statCalls.includes(path.resolve(certFolder)), 'createFolder should check folder existence');
    // Verify filesExists was called for cert paths
    assert.ok(statCalls.includes(path.resolve(certFolder, CERT_FILE_NAME)));
    assert.ok(statCalls.includes(path.resolve(certFolder, CERT_PRIVATE_KEY_FILE_NAME)));
    assert.ok(statCalls.includes(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME)));

    assert.strictEqual(generateCertMock.mock.calls.length, 0);
    assert.strictEqual(writeFileMock.mock.calls.length, 0);
    assert.strictEqual(encryptionService.certsFolder, certFolder);
  });

  it('should create certificate if it does not exist', async () => {
    // Make filesExists return false by having fs.stat throw for file paths (but resolve for folder)
    statMock.mock.mockImplementation(async (filePath: unknown) => {
      if (String(filePath) === path.resolve(certFolder)) return; // folder exists
      throw new Error('ENOENT'); // files don't exist
    });

    const generateCertMock = mock.method(
      encryptionService,
      'generateSelfSignedCertificate',
      mock.fn(async () => ({
        private: 'private',
        public: 'public',
        cert: 'cert'
      }))
    );

    await encryptionService.init(cryptoSettings, certFolder);

    assert.strictEqual(generateCertMock.mock.calls.length, 1);
    assert.deepStrictEqual(generateCertMock.mock.calls[0].arguments, [
      {
        commonName: 'OIBus',
        countryName: 'FR',
        stateOrProvinceName: 'Savoie',
        localityName: 'Chambery',
        organizationName: 'Optimistik',
        keySize: 4096,
        daysBeforeExpiry: 36500
      }
    ]);
    assert.deepStrictEqual(writeFileMock.mock.calls[0].arguments, [path.resolve(certFolder, CERT_PRIVATE_KEY_FILE_NAME), 'private']);
    assert.deepStrictEqual(writeFileMock.mock.calls[1].arguments, [path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME), 'public']);
    assert.deepStrictEqual(writeFileMock.mock.calls[2].arguments, [path.resolve(certFolder, CERT_FILE_NAME), 'cert']);
  });

  it('should properly retrieve files', async () => {
    let readCallCount = 0;
    readFileMock.mock.mockImplementation(async () => {
      readCallCount++;
      if (readCallCount === 1) return 'cert file content';
      if (readCallCount === 2) return 'private key file content';
      return 'public key file content';
    });

    assert.strictEqual(await encryptionService.getCert(), 'cert file content');
    assert.strictEqual(await encryptionService.getCert(), 'cert file content');
    assert.strictEqual(readFileMock.mock.calls.length, 1);
    assert.strictEqual(await encryptionService.getPrivateKey(), 'private key file content');
    assert.strictEqual(await encryptionService.getPrivateKey(), 'private key file content');
    assert.strictEqual(readFileMock.mock.calls.length, 2);
    assert.strictEqual(await encryptionService.getPublicKey(), 'public key file content');
    assert.strictEqual(await encryptionService.getPublicKey(), 'public key file content');
    assert.strictEqual(readFileMock.mock.calls.length, 3);
  });

  it('should properly encrypt text', async () => {
    const update = mock.fn(() => 'encrypted text');
    const final = mock.fn(() => '');
    createCipherivMock.mock.mockImplementation(() => ({ update, final }));

    const encryptedText = await encryptionService.encryptText('text to encrypt');
    assert.strictEqual(encryptedText, 'encrypted text');
    assert.deepStrictEqual(createCipherivMock.mock.calls[0].arguments, [
      cryptoSettings.algorithm,
      Buffer.from(cryptoSettings.securityKey, 'base64'),
      Buffer.from(cryptoSettings.initVector, 'base64')
    ]);
    assert.deepStrictEqual(update.mock.calls[0].arguments, ['text to encrypt', 'utf8', 'base64']);
    assert.deepStrictEqual(final.mock.calls[0].arguments, ['base64']);
  });

  it('should properly encrypt empty input', async () => {
    const encryptedText = await encryptionService.encryptText('');
    assert.strictEqual(encryptedText, '');
    assert.strictEqual(createCipherivMock.mock.calls.length, 0);
  });

  it('should throw error on encrypt when class is not initialized', async () => {
    encryptionService['initialized'] = false;
    await assert.rejects(encryptionService.encryptText('test'), { message: 'EncryptionService not initialized' });
  });

  it('should properly decrypt text', async () => {
    encryptionService['initialized'] = true;
    const update = mock.fn(() => 'decrypted text');
    const final = mock.fn(() => '');
    createDecipherivMock.mock.mockImplementation(() => ({ update, final }));

    const decryptedText = await encryptionService.decryptText('text to decrypt');
    assert.strictEqual(decryptedText, 'decrypted text');
    assert.deepStrictEqual(createDecipherivMock.mock.calls[0].arguments, [
      cryptoSettings.algorithm,
      Buffer.from(cryptoSettings.securityKey, 'base64'),
      Buffer.from(cryptoSettings.initVector, 'base64')
    ]);
    assert.deepStrictEqual(update.mock.calls[0].arguments, ['text to decrypt', 'base64', 'utf8']);
    assert.deepStrictEqual(final.mock.calls[0].arguments, ['utf8']);
  });

  it('should properly decrypt empty input', async () => {
    encryptionService['initialized'] = true;
    const decryptedText = await encryptionService.decryptText('');
    assert.strictEqual(decryptedText, '');
    assert.strictEqual(createCipherivMock.mock.calls.length, 0);
  });

  it('should throw error on decrypt when class is not initialized', async () => {
    encryptionService['initialized'] = false;
    await assert.rejects(encryptionService.decryptText('test'), { message: 'EncryptionService not initialized' });
  });

  it('should properly encrypt connector secrets', async () => {
    encryptionService['initialized'] = true;
    const command: SouthConnectorCommandDTO = {
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      settings: {
        field1: 'not a secret',
        field2: 'secret',
        field3: 'not a secret',
        field4: [
          { fieldArray1: 'not an array secret', fieldArray2: 'an array secret' },
          { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
        ],
        field5: {
          fieldGroup1: 'not a group secret',
          fieldGroup2: 'a group secret'
        }
      } as unknown as SouthOPCUASettings
    } as SouthConnectorCommandDTO;
    const connector: SouthConnectorDTO = {
      id: 'id1',
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      settings: {
        field1: 'not a secret',
        field2: 'secret',
        field3: 'not a secret'
      } as unknown as SouthOPCUASettings
    } as SouthConnectorDTO;

    const update = mock.fn(() => 'encrypted secret');
    const final = mock.fn(() => '');
    createCipherivMock.mock.mockImplementation(() => ({ update, final }));

    const expectedCommand = {
      field1: 'not a secret',
      field2: 'encrypted secret',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' },
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: 'encrypted secret'
      }
    };

    assert.deepStrictEqual(
      await encryptionService.encryptConnectorSecrets(command.settings, connector.settings, manifest),
      expectedCommand
    );
  });

  it('should properly encrypt connector secrets when no secret provided', async () => {
    encryptionService['initialized'] = true;
    const command: SouthConnectorCommandDTO = {
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      items: [],
      groups: [],
      settings: {
        field1: 'not a secret',
        field2: 'secret',
        field3: 'not a secret',
        field4: [
          { fieldArray1: 'not an array secret', fieldArray2: 'an array secret' },
          { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
        ],
        field5: {
          fieldGroup1: 'not a group secret',
          fieldGroup2: 'a group secret'
        }
      } as unknown as SouthOPCUASettings
    };

    const update = mock.fn(() => 'encrypted secret');
    const final = mock.fn(() => '');
    createCipherivMock.mock.mockImplementation(() => ({ update, final }));

    const expectedCommand = {
      field1: 'not a secret',
      field2: 'encrypted secret',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' },
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: 'encrypted secret'
      }
    };

    assert.deepStrictEqual(await encryptionService.encryptConnectorSecrets(command.settings, null, manifest), expectedCommand);
  });

  it('should properly keep existing and encrypted connector secrets', async () => {
    encryptionService['initialized'] = true;
    const command: SouthConnectorCommandDTO = {
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      items: [],
      groups: [],
      settings: {
        field1: 'not a secret',
        field2: '',
        field3: 'not a secret',
        field4: [
          { fieldArray1: 'not an array secret', fieldArray2: 'an array secret', fieldArray3: null },
          { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
        ],
        field5: {
          fieldGroup1: 'not a group secret',
          fieldGroup2: ''
        }
      } as unknown as SouthOPCUASettings
    };
    const connector: SouthConnectorDTO = {
      id: 'id1',
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      settings: {
        field1: 'not a secret',
        field2: 'encrypted secret',
        field3: 'not a secret',
        field4: [
          { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret' },
          { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret' }
        ],
        field5: {
          fieldGroup1: 'not a group secret',
          fieldGroup2: 'a group secret'
        }
      } as unknown as SouthOPCUASettings
    } as SouthConnectorDTO;
    const expectedCommand = {
      field1: 'not a secret',
      field2: 'encrypted secret',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' },
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: 'a group secret'
      }
    };

    const update = mock.fn(() => 'encrypted secret');
    const final = mock.fn(() => '');
    createCipherivMock.mock.mockImplementation(() => ({ update, final }));

    assert.deepStrictEqual(
      await encryptionService.encryptConnectorSecrets(command.settings, connector.settings, manifest),
      expectedCommand
    );
  });

  it('should properly decrypt connector secrets', async () => {
    encryptionService['initialized'] = true;
    const command: SouthConnectorCommandDTO = {
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      settings: {
        field1: 'not a secret',
        field2: 'secret',
        field3: 'not a secret',
        field4: [
          { fieldArray1: 'not an array secret', fieldArray2: 'an array secret' },
          { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
        ],
        field5: {
          fieldGroup1: 'not a group secret',
          fieldGroup2: 'a group secret'
        }
      } as unknown as SouthOPCUASettings
    } as SouthConnectorCommandDTO;

    const update = mock.fn(() => 'encrypted secret');
    const final = mock.fn(() => '');
    createDecipherivMock.mock.mockImplementation(() => ({ update, final }));

    const expectedCommand = {
      field1: 'not a secret',
      field2: 'encrypted secret',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' },
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: 'encrypted secret'
      }
    };

    assert.deepStrictEqual(await encryptionService.decryptConnectorSecrets(command.settings, manifest), expectedCommand);
  });

  it('should properly filter out secret', () => {
    const connector: SouthConnectorDTO = {
      id: 'id1',
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      settings: {
        field1: 'not a secret',
        field2: 'encrypted secret',
        field3: 'not a secret',
        field4: [
          { fieldArray1: 'not an array secret', fieldArray2: 'an array secret' },
          { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
        ],
        field5: {
          fieldGroup1: 'not a group secret',
          fieldGroup2: 'a group secret'
        }
      } as unknown as SouthOPCUASettings
    } as SouthConnectorDTO;

    assert.deepStrictEqual(encryptionService.filterSecrets(connector.settings, manifest), {
      field1: 'not a secret',
      field2: '',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: '', fieldArray3: '' },
        { fieldArray1: 'not an array secret', fieldArray2: '', fieldArray3: '' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: ''
      }
    });
  });

  it('should properly decrypt connector secrets with private key', async () => {
    const command: SouthConnectorCommandDTO = {
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      items: [],
      groups: [],
      settings: {
        field1: 'not a secret',
        field2: 'secret',
        field3: 'not a secret',
        field4: [
          { fieldArray1: 'not an array secret', fieldArray2: 'an array secret' },
          { fieldArray1: 'not an array secret', fieldArray2: 'another array secret' }
        ],
        field5: {
          fieldGroup1: 'not a group secret',
          fieldGroup2: 'a group secret'
        }
      } as unknown as SouthOPCUASettings
    };
    privateDecryptMock.mock.mockImplementation(() => Buffer.from('encrypted secret'));
    const expectedCommand = {
      field1: 'not a secret',
      field2: 'encrypted secret',
      field3: 'not a secret',
      field4: [
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' },
        { fieldArray1: 'not an array secret', fieldArray2: 'encrypted secret', fieldArray3: '' }
      ],
      field5: {
        fieldGroup1: 'not a group secret',
        fieldGroup2: 'encrypted secret'
      }
    };

    assert.deepStrictEqual(
      await encryptionService.decryptSecretsWithPrivateKey(command.settings, manifest, 'private key'),
      expectedCommand
    );
  });

  it('should generate a certificate with correct extensions and SANs', async () => {
    const options = {
      commonName: 'Test CN',
      countryName: 'FR',
      stateOrProvinceName: 'Savoie',
      localityName: 'Chambery',
      organizationName: 'Test Org',
      keySize: 2048,
      daysBeforeExpiry: 365
    };

    const result = await encryptionService.generateSelfSignedCertificate(options);

    assert.strictEqual((forgeModule.pki.rsa.generateKeyPair as ReturnType<typeof mock.fn>).mock.calls.length, 1);
    assert.deepStrictEqual((forgeModule.pki.rsa.generateKeyPair as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [2048]);

    const expectedAttrs = [
      { shortName: 'CN', value: 'Test CN' },
      { shortName: 'C', value: 'FR' },
      { shortName: 'ST', value: 'Savoie' },
      { shortName: 'L', value: 'Chambery' },
      { shortName: 'O', value: 'Test Org' }
    ];
    assert.deepStrictEqual(mockCert.setSubject.mock.calls[0].arguments, [expectedAttrs]);
    assert.deepStrictEqual(mockCert.setIssuer.mock.calls[0].arguments, [expectedAttrs]);

    const extensionsArg = mockCert.setExtensions.mock.calls[0].arguments[0];

    const basicConstraints = extensionsArg.find((e: { name: string; cA: boolean; critical: boolean }) => e.name === 'basicConstraints');
    assert.deepStrictEqual(basicConstraints, { name: 'basicConstraints', cA: false, critical: true });

    const san = extensionsArg.find((e: { name: string; altNames: Array<{ type: number; value: string }> }) => e.name === 'subjectAltName');
    assert.ok(san);
    assert.deepStrictEqual(san.altNames, [
      {
        type: 6,
        value: `urn:${os.hostname()}:OIBus`
      },
      {
        type: 2,
        value: os.hostname()
      }
    ]);

    assert.deepStrictEqual(result, {
      private: '-----BEGIN PRIVATE KEY-----',
      public: '-----BEGIN PUBLIC KEY-----',
      cert: '-----BEGIN CERTIFICATE-----'
    });
  });

  it('should filter out empty attributes', async () => {
    const options = {
      commonName: 'Test CN',
      countryName: 'FR',
      stateOrProvinceName: '',
      localityName: '',
      organizationName: '',
      keySize: 2048,
      daysBeforeExpiry: 365
    };

    await encryptionService.generateSelfSignedCertificate(options);

    const expectedAttrs = [
      { shortName: 'CN', value: 'Test CN' },
      { shortName: 'C', value: 'FR' }
    ];

    assert.deepStrictEqual(mockCert.setSubject.mock.calls[0].arguments, [expectedAttrs]);
    assert.deepStrictEqual(mockCert.setIssuer.mock.calls[0].arguments, [expectedAttrs]);
  });
});
