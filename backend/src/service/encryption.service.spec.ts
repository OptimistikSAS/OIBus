import fs from 'node:fs/promises';
import crypto from 'node:crypto';

import path from 'node:path';
import selfSigned from 'selfsigned';
import os from 'node:os';

import EncryptionService, {
  CERT_FILE_NAME,
  CERT_FOLDER,
  CERT_PRIVATE_KEY_FILE_NAME,
  CERT_PUBLIC_KEY_FILE_NAME
} from './encryption.service';

import * as utils from './utils';
import { OibFormControl } from '../../shared/model/form.model';

import { SouthConnectorCommandDTO, SouthConnectorDTO } from '../../shared/model/south-connector.model';
import { SouthItemSettings, SouthSettings } from '../../shared/model/south-settings.model';

jest.mock('./utils');
jest.mock('node:fs/promises');
jest.mock('node:crypto');
jest.mock('selfsigned');

let encryptionService: EncryptionService;

const cryptoSettings = {
  algorithm: 'aes-256-cbc',
  initVector: Buffer.from('0123456789abcdef').toString('base64'),
  securityKey: Buffer.from('0123456789abcdef').toString('base64')
};

const settings: Array<OibFormControl> = [
  {
    key: 'field1',
    type: 'OibText',
    label: 'Field 1'
  },
  {
    key: 'field2',
    type: 'OibSecret',
    label: 'Field 2'
  },
  {
    key: 'field3',
    type: 'OibText',
    label: 'Field 3'
  },
  {
    key: 'field4',
    type: 'OibArray',
    label: 'Field 4',
    content: [
      {
        key: 'fieldArray1',
        type: 'OibText',
        label: 'Field array 1'
      },
      {
        key: 'fieldArray2',
        type: 'OibSecret',
        label: 'Field array 2'
      },
      {
        key: 'fieldArray3',
        type: 'OibSecret',
        label: 'Field array 3'
      }
    ]
  },
  {
    key: 'field5',
    type: 'OibFormGroup',
    label: 'Field 5',
    content: [
      {
        key: 'fieldGroup1',
        type: 'OibText',
        label: 'Field group 1'
      },
      {
        key: 'fieldGroup2',
        type: 'OibSecret',
        label: 'Field group 2'
      }
    ]
  }
];

describe('Encryption service with crypto settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    encryptionService = new EncryptionService(cryptoSettings);
  });

  it('should properly initialized encryption service', () => {
    expect(encryptionService.getCertPath()).toEqual(path.resolve('./', CERT_FOLDER, CERT_FILE_NAME));
    expect(encryptionService.getPrivateKeyPath()).toEqual(path.resolve('./', CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME));
    expect(encryptionService.getPublicKeyPath()).toEqual(path.resolve('./', CERT_FOLDER, CERT_PUBLIC_KEY_FILE_NAME));
  });

  it('should not create certificate if it already exists', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(true);

    await encryptionService.init();
    expect(utils.createFolder).toHaveBeenCalledWith(path.resolve('./', CERT_FOLDER));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve('./', CERT_FOLDER, CERT_FILE_NAME));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve('./', CERT_FOLDER, CERT_PUBLIC_KEY_FILE_NAME));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve('./', CERT_FOLDER, CERT_PUBLIC_KEY_FILE_NAME));
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

    await encryptionService.init();
    expect(selfSigned.generate).toHaveBeenCalledWith(
      [
        { name: 'commonName', value: 'OIBus' },
        { name: 'countryName', value: 'FR' },
        { name: 'stateOrProvinceName', value: 'Savoie' },
        { name: 'localityName', value: 'Chambery' },
        { name: 'organizationName', value: 'Optimistik' }
      ],
      {
        keySize: 4096,
        days: 36500,
        algorithm: 'sha256',
        pkcs7: true,
        extensions: [
          {
            name: 'basicConstraints',
            cA: false
          },
          {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
          },
          {
            name: 'extKeyUsage',
            clientAuth: true,
            serverAuth: true
          },
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 6, // URI
                value: `urn:${os.hostname()}:OIBus`
              },
              {
                type: 2, // DNS
                value: os.hostname()
              }
            ]
          }
        ]
      }
    );
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve('./', CERT_FOLDER, CERT_PRIVATE_KEY_FILE_NAME), 'myPrivateKey');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve('./', CERT_FOLDER, CERT_PUBLIC_KEY_FILE_NAME), 'myPublicKey');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve('./', CERT_FOLDER, CERT_FILE_NAME), 'myCert');
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

  it('should properly decrypt text', async () => {
    const update = jest.fn(() => 'decrypted text');
    const final = jest.fn(() => '');
    (crypto.createDecipheriv as jest.Mock).mockImplementationOnce(() => ({
      update,
      final
    }));

    const encryptedText = await encryptionService.decryptText('text to decrypt');
    expect(encryptedText).toEqual('decrypted text');
    expect(crypto.createDecipheriv).toHaveBeenCalledWith(
      cryptoSettings.algorithm,
      Buffer.from(cryptoSettings.securityKey, 'base64'),
      Buffer.from(cryptoSettings.initVector, 'base64')
    );
    expect(update).toHaveBeenCalledWith('text to decrypt', 'base64', 'utf8');
    expect(final).toHaveBeenCalledWith('utf8');
  });

  it('should properly encrypt connector secrets', async () => {
    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      name: 'connector',
      type: 'any',
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
    } as SouthConnectorCommandDTO<SouthSettings, SouthItemSettings>;
    const connector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
      id: 'id1',
      name: 'connector',
      type: 'any',
      description: 'my connector',
      enabled: true,
      settings: {
        field1: 'not a secret',
        field2: 'secret',
        field3: 'not a secret'
      } as unknown as SouthSettings
    } as SouthConnectorDTO<SouthSettings, SouthItemSettings>;

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

    expect(await encryptionService.encryptConnectorSecrets(command.settings, connector.settings, settings)).toEqual(expectedCommand);
  });

  it('should properly encrypt connector secrets when no secret provided', async () => {
    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      name: 'connector',
      type: 'any',
      description: 'my connector',
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
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

    expect(await encryptionService.encryptConnectorSecrets(command.settings, null, settings)).toEqual(expectedCommand);
  });

  it('should properly keep existing and encrypted connector secrets', async () => {
    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      name: 'connector',
      type: 'any',
      description: 'my connector',
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
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
    const connector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
      id: 'id1',
      name: 'connector',
      type: 'any',
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
    } as SouthConnectorDTO<SouthSettings, SouthItemSettings>;
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

    expect(await encryptionService.encryptConnectorSecrets(command.settings, connector.settings, settings)).toEqual(expectedCommand);
  });

  it('should properly filter out secret', () => {
    const connector: SouthConnectorDTO<SouthSettings, SouthItemSettings> = {
      id: 'id1',
      name: 'connector',
      type: 'any',
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
    } as SouthConnectorDTO<SouthSettings, SouthItemSettings>;

    expect(encryptionService.filterSecrets(connector.settings, settings)).toEqual({
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
    const command: SouthConnectorCommandDTO<SouthSettings, SouthItemSettings> = {
      name: 'connector',
      type: 'any',
      description: 'my connector',
      enabled: true,
      history: {
        maxInstantPerItem: true,
        maxReadInterval: 3600,
        readDelay: 0,
        overlap: 0
      },
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

    expect(await encryptionService.decryptSecretsWithPrivateKey(command.settings, settings, 'private key')).toEqual(expectedCommand);
  });
});
