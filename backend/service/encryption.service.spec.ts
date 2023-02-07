import fs from 'node:fs/promises';
import crypto from 'node:crypto';

import path from 'node:path';
import selfSigned from 'selfsigned';
import os from 'node:os';
import EncryptionService from './encryption.service';

import * as utils from './utils';

jest.mock('./utils');
jest.mock('node:fs/promises');
jest.mock('node:crypto');
jest.mock('selfsigned');

const keyFolder = 'myTestKeys';
const certsFolder = 'myTestCerts';
let encryptionService: EncryptionService;

describe('Encryption service', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    encryptionService = new EncryptionService(keyFolder, certsFolder);
  });

  it('should properly initialized encryption service', () => {
    expect(encryptionService.keyFolder).toEqual(keyFolder);
    expect(encryptionService.certsFolder).toEqual(certsFolder);
    expect(encryptionService.privateKey).toEqual('');
    expect(encryptionService.publicKey).toEqual('');
  });

  it('should not create private and public keys if exist', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(true);

    await encryptionService.checkOrCreatePrivateKey();
    expect(utils.createFolder).toHaveBeenCalledWith(keyFolder);
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(keyFolder, 'private.pem'));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(keyFolder, 'public.pem'));
    expect(crypto.generateKeyPairSync).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should create private and public keys if they do not exist', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(false);
    (crypto.generateKeyPairSync as jest.Mock).mockReturnValue({ privateKey: 'myPrivateKey', publicKey: 'myPublicKey' });

    await encryptionService.checkOrCreatePrivateKey();
    expect(utils.createFolder).toHaveBeenCalledWith(keyFolder);
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(keyFolder, 'private.pem'));
    expect(crypto.generateKeyPairSync).toHaveBeenCalledWith('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: ''
      }
    });
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(keyFolder, 'private.pem'), 'myPrivateKey');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(keyFolder, 'public.pem'), 'myPublicKey');
  });

  it('should not create certificate if it already exists', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(true);

    await encryptionService.checkOrCreateCertFiles();
    expect(utils.createFolder).toHaveBeenCalledWith(certsFolder);
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certsFolder, 'privateKey.pem'));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certsFolder, 'publicKey.pem'));
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certsFolder, 'cert.pem'));
    expect(selfSigned.generate).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it('should create certificate if it does not exist', async () => {
    (utils.filesExists as jest.Mock).mockReturnValue(false);
    (selfSigned.generate as jest.Mock).mockReturnValue({ private: 'myPrivateKey', public: 'myPublicKey', cert: 'myCert' });

    await encryptionService.checkOrCreateCertFiles();
    expect(utils.createFolder).toHaveBeenCalledWith(certsFolder);
    expect(utils.filesExists).toHaveBeenCalledWith(path.resolve(certsFolder, 'privateKey.pem'));
    expect(selfSigned.generate).toHaveBeenCalledWith(
      [
        { name: 'commonName', value: 'OIBus' },
        { name: 'countryName', value: 'FR' },
        { name: 'stateOrProvinceName', value: 'Savoie' },
        { name: 'localityName', value: 'Chambery' },
        { name: 'organizationName', value: 'Optimistik' },
        { name: 'organizationalUnitName', value: 'R&D' }
      ],
      {
        keySize: 2048,
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
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certsFolder, 'privateKey.pem'), 'myPrivateKey');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certsFolder, 'publicKey.pem'), 'myPublicKey');
    expect(fs.writeFile).toHaveBeenCalledWith(path.resolve(certsFolder, 'cert.pem'), 'myCert');
  });

  it('should properly encrypt text', async () => {
    const expectedResult = 'myEncryptedText';
    const myPublicKey = 'myPublicKey';
    const myPlainText = 'text to encrypt';
    (crypto.publicEncrypt as jest.Mock).mockReturnValue(expectedResult);
    (fs.readFile as jest.Mock).mockReturnValue(myPublicKey);

    const encryptedText = await encryptionService.encryptText('text to encrypt');

    expect(encryptedText).toEqual(expectedResult);
    expect(crypto.publicEncrypt).toHaveBeenCalledWith(myPublicKey, Buffer.from(myPlainText, 'utf8'));
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(keyFolder, 'public.pem'), 'utf8');
  });

  it('should properly decrypt text', async () => {
    const myEncryptedText = 'myEncryptedText';
    const myPrivateKey = 'myPrivateKey';
    const expectedResult = 'myPlainText';
    (crypto.privateDecrypt as jest.Mock).mockReturnValue(expectedResult);
    (fs.readFile as jest.Mock).mockReturnValue(myPrivateKey);

    const decryptedText = await encryptionService.decryptText('myEncryptedText');

    expect(decryptedText).toEqual(expectedResult);
    expect(crypto.privateDecrypt).toHaveBeenCalledWith(
      {
        key: myPrivateKey,
        passphrase: '',
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
      },
      Buffer.from(myEncryptedText, 'base64')
    );
    expect(fs.readFile).toHaveBeenCalledWith(path.resolve(keyFolder, 'private.pem'), 'utf8');
  });

  it('should encrypt secrets', async () => {
    const myPublicKey = 'myPublicKey';
    (crypto.publicEncrypt as jest.Mock).mockReturnValueOnce('encryptedPassword').mockReturnValueOnce('encryptedSecretKey');
    (fs.readFile as jest.Mock).mockReturnValue(myPublicKey);
    const objectToEncrypt = {
      key1: 'key1',
      password: '{{notEncrypted}}password',
      object1: {
        key2: 'key2',
        secretKey: '{{notEncrypted}}secretKey'
      }
    };
    const expectedResult = {
      key1: 'key1',
      password: 'encryptedPassword',
      object1: {
        key2: 'key2',
        secretKey: 'encryptedSecretKey'
      }
    };

    await encryptionService.encryptSecrets(objectToEncrypt);

    expect(objectToEncrypt).toEqual(expectedResult);
    expect(crypto.publicEncrypt).toHaveBeenCalledWith(myPublicKey, Buffer.from('password', 'utf8'));
    expect(crypto.publicEncrypt).toHaveBeenCalledWith(myPublicKey, Buffer.from('secretKey', 'utf8'));
    expect(crypto.publicEncrypt).toHaveBeenCalledTimes(2);
  });

  it('should not encrypt secrets if entry is null', async () => {
    const mySpy = jest.spyOn(Object, 'entries');

    await encryptionService.encryptSecrets(null);

    expect(mySpy).not.toHaveBeenCalled();
  });
});
