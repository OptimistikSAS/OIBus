import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import {
  OIBusArrayAttribute,
  OIBusObjectAttribute,
  OIBusSecretAttribute,
  OIBusStringAttribute
} from '../../shared/model/connector/form.model';

import testData from '../tests/utils/test-data';
import { seq } from '../tests/utils/test-utils';
import EncryptionService, { CERT_FILE_NAME, CERT_PRIVATE_KEY_FILE_NAME, CERT_PUBLIC_KEY_FILE_NAME } from './encryption.service';

const nodeRequire = createRequire(import.meta.url);
const forgeModule = nodeRequire('node-forge');

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

// Settings matching the manifest above, with all their secrets set
const secretSettings = {
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
};
// The same settings once their secrets went through a cipher returning 'encrypted secret'
const encryptedSettings = {
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

const certFolder = 'certFolder';

// Certificate object created by forge, to spy on its methods
const createCertMock = () => ({
  publicKey: null,
  serialNumber: null,
  validity: {},
  setSubject: mock.fn(),
  setIssuer: mock.fn(),
  setExtensions: mock.fn(),
  sign: mock.fn()
});

describe('Encryption Service', () => {
  let statMock: ReturnType<typeof mock.fn>;
  let readFileMock: ReturnType<typeof mock.fn>;
  let writeFileMock: ReturnType<typeof mock.fn>;
  let createCipherivMock: ReturnType<typeof mock.fn>;
  let createDecipherivMock: ReturnType<typeof mock.fn>;
  let privateDecryptMock: ReturnType<typeof mock.fn>;
  let generateKeyPairMock: ReturnType<typeof mock.fn>;
  let mockCert: ReturnType<typeof createCertMock>;

  /** Makes the next ciphers or deciphers return `output`. */
  const mockCipher = (cipherMock: ReturnType<typeof mock.fn>, output: string) => {
    const update = mock.fn(() => output);
    const final = mock.fn(() => '');
    cipherMock.mock.mockImplementation(() => ({ update, final }));
    return { update, final };
  };

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

    mockCert = createCertMock();
    generateKeyPairMock = mock.method(forgeModule.pki.rsa, 'generateKeyPair', () => ({
      privateKey: 'MOCK_PRIV_KEY',
      publicKey: 'MOCK_PUB_KEY'
    }));
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
    readFileMock.mock.mockImplementation(
      seq(
        async () => 'cert file content',
        async () => 'private key file content',
        async () => 'public key file content'
      )
    );

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
    const { update, final } = mockCipher(createCipherivMock, 'encrypted text');

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

  it('should throw error on encrypt when class is not initialized', () => {
    encryptionService['initialized'] = false;
    assert.throws(() => encryptionService.encryptText('test'), { message: 'EncryptionService not initialized' });
  });

  it('should properly decrypt text', async () => {
    const { update, final } = mockCipher(createDecipherivMock, 'decrypted text');

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
    const decryptedText = await encryptionService.decryptText('');
    assert.strictEqual(decryptedText, '');
    assert.strictEqual(createCipherivMock.mock.calls.length, 0);
  });

  it('should throw error on decrypt when class is not initialized', () => {
    encryptionService['initialized'] = false;
    assert.throws(() => encryptionService.decryptText('test'), { message: 'EncryptionService not initialized' });
  });

  it('should properly encrypt connector secrets', async () => {
    const previousSettings = { field1: 'not a secret', field2: 'secret', field3: 'not a secret' };
    mockCipher(createCipherivMock, 'encrypted secret');

    assert.deepStrictEqual(
      await encryptionService.encryptConnectorSecrets<Record<string, unknown>>(secretSettings, previousSettings, manifest),
      encryptedSettings
    );
  });

  it('should properly encrypt connector secrets when no secret provided', async () => {
    mockCipher(createCipherivMock, 'encrypted secret');

    assert.deepStrictEqual(await encryptionService.encryptConnectorSecrets(secretSettings, null, manifest), encryptedSettings);
  });

  it('should properly keep existing and encrypted connector secrets', async () => {
    const newSettings = {
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
    };
    const previousSettings = {
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
    };
    mockCipher(createCipherivMock, 'encrypted secret');

    assert.deepStrictEqual(
      await encryptionService.encryptConnectorSecrets<Record<string, unknown>>(newSettings, previousSettings, manifest),
      { ...encryptedSettings, field5: { fieldGroup1: 'not a group secret', fieldGroup2: 'a group secret' } }
    );
  });

  it('should properly decrypt connector secrets', async () => {
    mockCipher(createDecipherivMock, 'encrypted secret');

    assert.deepStrictEqual(await encryptionService.decryptConnectorSecrets(secretSettings, manifest), encryptedSettings);
  });

  it('should properly filter out secret', () => {
    const settings = { ...secretSettings, field2: 'encrypted secret' };

    assert.deepStrictEqual(encryptionService.filterSecrets(settings, manifest), {
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
    privateDecryptMock.mock.mockImplementation(() => Buffer.from('encrypted secret'));

    assert.deepStrictEqual(
      await encryptionService.decryptSecretsWithPrivateKey(secretSettings, manifest, 'private key'),
      encryptedSettings
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

    assert.strictEqual(generateKeyPairMock.mock.calls.length, 1);
    assert.deepStrictEqual(generateKeyPairMock.mock.calls[0].arguments, [2048]);

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
