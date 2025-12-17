import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as forge from 'node-forge';
import path from 'node:path';

import EncryptionService, { CERT_FILE_NAME, CERT_PRIVATE_KEY_FILE_NAME, CERT_PUBLIC_KEY_FILE_NAME } from './encryption.service';

import * as utils from './utils';

import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../shared/model/south-connector.model';
import { SouthOPCUASettings } from '../../shared/model/south-settings.model';
import { OIBusArrayAttribute, OIBusObjectAttribute, OIBusSecretAttribute, OIBusStringAttribute } from '../../shared/model/form.model';
import testData from '../tests/utils/test-data';
import os from 'node:os';

jest.mock('./utils');
jest.mock('node:fs/promises');
jest.mock('node:crypto');
// MOCK NODE-FORGE
// We create a mock certificate object that allows us to spy on methods like setExtensions
const mockCert = {
  publicKey: null,
  serialNumber: null,
  validity: {},
  setSubject: jest.fn(),
  setIssuer: jest.fn(),
  setExtensions: jest.fn(),
  sign: jest.fn()
};
jest.mock('node-forge', () => ({
  pki: {
    rsa: {
      generateKeyPair: jest.fn(() => ({ privateKey: 'MOCK_PRIV_KEY', publicKey: 'MOCK_PUB_KEY' }))
    },
    createCertificate: jest.fn(() => mockCert),
    privateKeyToPem: jest.fn(() => '-----BEGIN PRIVATE KEY-----'),
    publicKeyToPem: jest.fn(() => '-----BEGIN PUBLIC KEY-----'),
    certificateToPem: jest.fn(() => '-----BEGIN CERTIFICATE-----')
  },
  md: {
    sha256: { create: jest.fn() }
  },
  util: {
    bytesToHex: jest.fn(() => 'HEX123')
  },
  random: {
    getBytesSync: jest.fn()
  }
}));

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
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    // (os.hostname as jest.Mock).mockReturnValue('TEST_HOST');
  });

  it('should not create certificate if it already exists', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(true);
    encryptionService.generateSelfSignedCertificate = jest.fn();
    await encryptionService.init(cryptoSettings, certFolder);

    expect(utils.createFolder).toHaveBeenCalledWith(certFolder);
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certFolder, CERT_FILE_NAME));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME));
    expect(encryptionService.generateSelfSignedCertificate).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(encryptionService.certsFolder).toEqual(certFolder);
    encryptionService.generateSelfSignedCertificate = EncryptionService.prototype.generateSelfSignedCertificate;
  });

  it('should create certificate if it does not exist', async () => {
    encryptionService.generateSelfSignedCertificate = jest.fn().mockReturnValueOnce({ private: 'private', public: 'public', cert: 'cert' });
    (utils.filesExists as jest.Mock).mockReturnValue(false);

    await encryptionService.init(cryptoSettings, certFolder);

    expect(encryptionService.generateSelfSignedCertificate).toHaveBeenCalledWith({
      commonName: 'OIBus',
      countryName: 'FR',
      stateOrProvinceName: 'Savoie',
      localityName: 'Chambery',
      organizationName: 'Optimistik',
      keySize: 4096,
      daysBeforeExpiry: 36500
    });
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PRIVATE_KEY_FILE_NAME), 'private');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME), 'public');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certFolder, CERT_FILE_NAME), 'cert');
    encryptionService.generateSelfSignedCertificate = EncryptionService.prototype.generateSelfSignedCertificate;
  });

  it('should properly retrieve files', async () => {
    (fs.readFile as jest.Mock)
      .mockReturnValueOnce('cert file content')
      .mockReturnValueOnce('private key file content')
      .mockReturnValueOnce('public key file content');

    expect(await encryptionService.getCert()).toEqual('cert file content');
    expect(await encryptionService.getCert()).toEqual('cert file content');
    expect(fs.readFile).toHaveBeenCalledTimes(1);
    expect(await encryptionService.getPrivateKey()).toEqual('private key file content');
    expect(await encryptionService.getPrivateKey()).toEqual('private key file content');
    expect(fs.readFile).toHaveBeenCalledTimes(2);
    expect(await encryptionService.getPublicKey()).toEqual('public key file content');
    expect(await encryptionService.getPublicKey()).toEqual('public key file content');
    expect(fs.readFile).toHaveBeenCalledTimes(3);
  });

  it('should properly encrypt text', async () => {
    const update = jest.fn(() => 'encrypted text');
    const final = jest.fn(() => '');
    (crypto.createCipheriv as jest.Mock).mockImplementationOnce(() => ({
      update,
      final
    }));

    const encryptedText = await encryptionService.encryptText('text to encrypt');
    expect(encryptedText).toEqual('encrypted text');
    expect(crypto.createCipheriv).toHaveBeenCalledWith(
      cryptoSettings.algorithm,
      Buffer.from(cryptoSettings.securityKey, 'base64'),
      Buffer.from(cryptoSettings.initVector, 'base64')
    );
    expect(update).toHaveBeenCalledWith('text to encrypt', 'utf8', 'base64');
    expect(final).toHaveBeenCalledWith('base64');
  });

  it('should properly encrypt empty input', async () => {
    const encryptedText = await encryptionService.encryptText('');
    expect(encryptedText).toEqual('');
    expect(crypto.createCipheriv).not.toHaveBeenCalled();
  });

  it('should throw error on encrypt when class is not initialized', async () => {
    encryptionService['initialized'] = false;
    await expect(encryptionService.encryptText('test')).rejects.toThrow('EncryptionService not initialized');
  });

  it('should properly decrypt text', async () => {
    encryptionService['initialized'] = true;
    const update = jest.fn(() => 'decrypted text');
    const final = jest.fn(() => '');
    (crypto.createDecipheriv as jest.Mock).mockImplementationOnce(() => ({
      update,
      final
    }));

    const decryptedText = await encryptionService.decryptText('text to decrypt');
    expect(decryptedText).toEqual('decrypted text');
    expect(crypto.createDecipheriv).toHaveBeenCalledWith(
      cryptoSettings.algorithm,
      Buffer.from(cryptoSettings.securityKey, 'base64'),
      Buffer.from(cryptoSettings.initVector, 'base64')
    );
    expect(update).toHaveBeenCalledWith('text to decrypt', 'base64', 'utf8');
    expect(final).toHaveBeenCalledWith('utf8');
  });

  it('should properly decrypt empty input', async () => {
    encryptionService['initialized'] = true;
    const decryptedText = await encryptionService.decryptText('');
    expect(decryptedText).toEqual('');
    expect(crypto.createCipheriv).not.toHaveBeenCalled();
  });

  it('should throw error on decrypt when class is not initialized', async () => {
    encryptionService['initialized'] = false;
    await expect(encryptionService.decryptText('test')).rejects.toThrow('EncryptionService not initialized');
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

    const update = jest.fn(() => 'encrypted secret');
    const final = jest.fn(() => '');
    (crypto.createCipheriv as jest.Mock).mockImplementation(() => ({
      update,
      final
    }));

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

    expect(await encryptionService.encryptConnectorSecrets(command.settings, connector.settings, manifest)).toEqual(expectedCommand);
  });

  it('should properly encrypt connector secrets when no secret provided', async () => {
    encryptionService['initialized'] = true;
    const command: SouthConnectorCommandDTO = {
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      items: [],
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

    const update = jest.fn(() => 'encrypted secret');
    const final = jest.fn(() => '');
    (crypto.createCipheriv as jest.Mock).mockImplementation(() => ({
      update,
      final
    }));

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

    expect(await encryptionService.encryptConnectorSecrets(command.settings, null, manifest)).toEqual(expectedCommand);
  });

  it('should properly keep existing and encrypted connector secrets', async () => {
    encryptionService['initialized'] = true;
    const command: SouthConnectorCommandDTO = {
      name: 'connector',
      type: 'opcua',
      description: 'my connector',
      enabled: true,
      items: [],
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

    const update = jest.fn(() => 'encrypted secret');
    const final = jest.fn(() => '');
    (crypto.createCipheriv as jest.Mock).mockImplementation(() => ({
      update,
      final
    }));

    expect(await encryptionService.encryptConnectorSecrets(command.settings, connector.settings, manifest)).toEqual(expectedCommand);
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

    const update = jest.fn(() => 'encrypted secret');
    const final = jest.fn(() => '');
    (crypto.createDecipheriv as jest.Mock).mockImplementation(() => ({
      update,
      final
    }));

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

    expect(await encryptionService.decryptConnectorSecrets(command.settings, manifest)).toEqual(expectedCommand);
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

    expect(encryptionService.filterSecrets(connector.settings, manifest)).toEqual({
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
    (crypto.privateDecrypt as jest.Mock).mockImplementation(() => 'encrypted secret');
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

    expect(await encryptionService.decryptSecretsWithPrivateKey(command.settings, manifest, 'private key')).toEqual(expectedCommand);
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

    // 1. Check Keys Generation
    expect(forge.pki.rsa.generateKeyPair).toHaveBeenCalledWith(2048);

    // 2. Check Subject and Issuer (Short names)
    // We expect 5 items because all fields are provided
    const expectedAttrs = [
      { shortName: 'CN', value: 'Test CN' },
      { shortName: 'C', value: 'FR' },
      { shortName: 'ST', value: 'Savoie' },
      { shortName: 'L', value: 'Chambery' },
      { shortName: 'O', value: 'Test Org' }
    ];
    expect(mockCert.setSubject).toHaveBeenCalledWith(expectedAttrs);
    expect(mockCert.setIssuer).toHaveBeenCalledWith(expectedAttrs);

    // 3. Check Extensions (CRITICAL: Verify SubjectAltName)
    // We capture the array passed to setExtensions to inspect it deeply
    const extensionsArg = (mockCert.setExtensions as jest.Mock).mock.calls[0][0];

    // Check basic constraints
    const basicConstraints = extensionsArg.find((e: { name: string; cA: boolean; critical: boolean }) => e.name === 'basicConstraints');
    expect(basicConstraints).toEqual({ name: 'basicConstraints', cA: false, critical: true });

    // Check Subject Alternative Name
    const san = extensionsArg.find((e: { name: string; altNames: Array<{ type: number; value: string }> }) => e.name === 'subjectAltName');
    expect(san).toBeDefined();
    expect(san.altNames).toEqual([
      {
        type: 6, // URI
        value: `urn:${os.hostname()}:OIBus`
      },
      {
        type: 2, // DNS
        value: os.hostname()
      }
    ]);

    // 4. Check Return Output
    expect(result).toEqual({
      private: '-----BEGIN PRIVATE KEY-----',
      public: '-----BEGIN PUBLIC KEY-----',
      cert: '-----BEGIN CERTIFICATE-----'
    });
  });

  it('should filter out empty attributes', async () => {
    const options = {
      commonName: 'Test CN',
      countryName: 'FR',
      stateOrProvinceName: '', // EMPTY -> Should be removed
      localityName: '', // NULL -> Should be removed
      organizationName: '', // UNDEFINED -> Should be removed
      keySize: 2048,
      daysBeforeExpiry: 365
    };

    await encryptionService.generateSelfSignedCertificate(options);

    // We expect only CN and C because the others were empty/null
    const expectedAttrs = [
      { shortName: 'CN', value: 'Test CN' },
      { shortName: 'C', value: 'FR' }
    ];

    expect(mockCert.setSubject).toHaveBeenCalledWith(expectedAttrs);
    expect(mockCert.setIssuer).toHaveBeenCalledWith(expectedAttrs);
  });
});
