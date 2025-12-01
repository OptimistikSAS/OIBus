import fs from 'node:fs/promises';
import crypto from 'node:crypto';

import path from 'node:path';
import selfSigned from 'selfsigned';
import os from 'node:os';

import EncryptionService, { CERT_FILE_NAME, CERT_PRIVATE_KEY_FILE_NAME, CERT_PUBLIC_KEY_FILE_NAME } from './encryption.service';

import * as utils from './utils';

import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../shared/model/south-connector.model';
import { SouthSettings } from '../../shared/model/south-settings.model';
import { OIBusArrayAttribute, OIBusObjectAttribute, OIBusSecretAttribute, OIBusStringAttribute } from '../../shared/model/form.model';
import testData from '../tests/utils/test-data';
import { DateTime } from 'luxon';

jest.mock('./utils');
jest.mock('node:fs/promises');
jest.mock('node:crypto');
jest.mock('selfsigned');

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
describe('Encryption service with crypto settings', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));

    (utils.filesExists as jest.Mock).mockResolvedValue(true);

    await encryptionService.init(cryptoSettings, certFolder);
  });

  it('should properly initialized encryption service', () => {
    expect(encryptionService.certsFolder).toEqual(certFolder);
    expect(encryptionService.getCertPath()).toEqual(path.resolve(certFolder, CERT_FILE_NAME));
    expect(encryptionService.getPrivateKeyPath()).toEqual(path.resolve(certFolder, CERT_PRIVATE_KEY_FILE_NAME));
    expect(encryptionService.getPublicKeyPath()).toEqual(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME));
  });

  it('should not create certificate if it already exists', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(true);

    expect(utils.createFolder).toHaveBeenCalledWith(certFolder);
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certFolder, CERT_FILE_NAME));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME));
    expect(selfSigned.generate).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should create certificate if it does not exist', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(false);
    (selfSigned.generate as jest.Mock).mockReturnValue({
      private: 'myPrivateKey',
      public: 'myPublicKey',
      cert: 'myCert'
    });

    await encryptionService.init(cryptoSettings, certFolder);

    expect(selfSigned.generate).toHaveBeenCalledWith(
      [
        { name: 'commonName', value: 'OIBus' },
        { name: 'countryName', value: 'FR' },
        { shortName: 'ST', value: 'Savoie' },
        { name: 'localityName', value: 'Chambery' },
        { name: 'organizationName', value: 'Optimistik' }
      ],
      {
        keySize: 4096,
        notAfterDate: DateTime.now().plus({ days: 36500 }).toJSDate(),
        algorithm: 'sha256',
        pkcs7: true,
        extensions: [
          {
            name: 'basicConstraints',
            cA: false,
            critical: true
          },
          {
            name: 'keyUsage',
            usages: ['digitalSignature', 'keyEncipherment', 'dataEncipherment', 'nonRepudiation', 'keyCertSign']
          },
          {
            name: 'extKeyUsage',
            usages: ['clientAuth', 'serverAuth']
          },
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 'uri',
                value: `urn:${os.hostname()}:OIBus`
              },
              {
                // v5 uses string types, not numeric IDs (type: 2 is now "dns")
                type: 'dns',
                value: os.hostname()
              }
            ]
          }
        ]
      }
    );
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PRIVATE_KEY_FILE_NAME), 'myPrivateKey');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certFolder, CERT_PUBLIC_KEY_FILE_NAME), 'myPublicKey');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certFolder, CERT_FILE_NAME), 'myCert');
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
    const decryptedText = await encryptionService.decryptText('');
    expect(decryptedText).toEqual('');
    expect(crypto.createCipheriv).not.toHaveBeenCalled();
  });

  it('should throw error on decrypt when class is not initialized', async () => {
    encryptionService['initialized'] = false;
    await expect(encryptionService.decryptText('test')).rejects.toThrow('EncryptionService not initialized');
  });

  it('should properly encrypt connector secrets', async () => {
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
      } as unknown as SouthSettings
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
      } as unknown as SouthSettings
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
      } as unknown as SouthSettings
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
      } as unknown as SouthSettings
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
      } as unknown as SouthSettings
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
      } as unknown as SouthSettings
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
      } as unknown as SouthSettings
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
      } as unknown as SouthSettings
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
});
