import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import selfSigned from 'selfsigned';

import { createFolder, filesExists } from './utils';
import { OibFormControl } from '../../../shared/model/form.model';
import { CryptoSettings } from '../../../shared/model/engine.model';
import { SouthSettings } from '../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../shared/model/north-settings.model';

export const CERT_FOLDER = 'certs';
export const CERT_PRIVATE_KEY_FILE_NAME = 'private.pem';
export const CERT_PUBLIC_KEY_FILE_NAME = 'public.pem';
export const CERT_FILE_NAME = 'cert.pem';

/**
 * Service used to manage encryption and decryption of secrets in the config file
 * Also responsible to create private and public key used for encrypting the secrets
 */
export default class EncryptionService {
  private readonly cryptoSettings: { algorithm: string; initVector: Buffer; securityKey: Buffer };
  private readonly _certsFolder: string = '';
  private _publicKey: string | null = null;
  private _privateKey: string | null = null;
  private _certFile: string | null = null;

  constructor(cryptoSettings: CryptoSettings) {
    this.cryptoSettings = {
      algorithm: cryptoSettings.algorithm,
      initVector: Buffer.from(cryptoSettings.initVector, 'base64'),
      securityKey: Buffer.from(cryptoSettings.securityKey, 'base64')
    };
    this._certsFolder = path.resolve('./', CERT_FOLDER);
  }

  getCertPath(): string {
    return path.resolve(this._certsFolder, CERT_FILE_NAME);
  }

  getPrivateKeyPath(): string {
    return path.resolve(this._certsFolder, CERT_PRIVATE_KEY_FILE_NAME);
  }

  getPublicKeyPath(): string {
    return path.resolve(this._certsFolder, CERT_PUBLIC_KEY_FILE_NAME);
  }

  async getCert(): Promise<string> {
    if (!this._certFile) {
      this._certFile = await fs.readFile(this.getCertPath(), 'utf8');
    }
    return this._certFile;
  }

  async getPrivateKey(): Promise<string> {
    if (!this._privateKey) {
      this._privateKey = await fs.readFile(this.getPrivateKeyPath(), 'utf8');
    }
    return this._privateKey;
  }

  async getPublicKey(): Promise<string> {
    if (!this._publicKey) {
      this._publicKey = await fs.readFile(this.getPublicKeyPath(), 'utf8');
    }
    return this._publicKey;
  }

  async init() {
    await createFolder(this._certsFolder);

    if (
      !(await filesExists(this.getCertPath())) ||
      !(await filesExists(this.getPrivateKeyPath())) ||
      !(await filesExists(this.getPublicKeyPath()))
    ) {
      const certificate = selfSigned.generate(
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
      await fs.writeFile(this.getPrivateKeyPath(), certificate.private);
      await fs.writeFile(this.getPublicKeyPath(), certificate.public);
      await fs.writeFile(this.getCertPath(), certificate.cert);
    }
  }

  async encryptConnectorSecrets(
    newSettings: any,
    oldSettings: any,
    formSettings: Array<OibFormControl>
  ): Promise<SouthSettings | NorthSettings> {
    const encryptedSettings: any = JSON.parse(JSON.stringify(newSettings));
    for (const fieldSettings of formSettings) {
      if (fieldSettings.type === 'OibSecret') {
        if (encryptedSettings[fieldSettings.key]) {
          encryptedSettings[fieldSettings.key] = await this.encryptText(encryptedSettings[fieldSettings.key]);
        } else {
          encryptedSettings[fieldSettings.key] = oldSettings ? oldSettings[fieldSettings.key] || '' : '';
        }
      }
    }
    return encryptedSettings;
  }

  filterSecrets(connectorSettings: any, formSettings: Array<OibFormControl>): SouthSettings | NorthSettings {
    for (const fieldSettings of formSettings) {
      if (fieldSettings.type === 'OibSecret') {
        connectorSettings[fieldSettings.key] = '';
      }
    }
    return connectorSettings;
  }

  /**
   * Return the encrypted text
   */
  async encryptText(plainText: string): Promise<string> {
    const cipher = crypto.createCipheriv(this.cryptoSettings.algorithm, this.cryptoSettings.securityKey, this.cryptoSettings.initVector);
    let encryptedData = cipher.update(plainText, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    return encryptedData;
  }

  /**
   * Return the decrypted text
   */
  async decryptText(encryptedText: string): Promise<string> {
    const decipher = crypto.createDecipheriv(
      this.cryptoSettings.algorithm,
      this.cryptoSettings.securityKey,
      this.cryptoSettings.initVector
    );

    let decryptedData = decipher.update(encryptedText, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');
    return decryptedData;
  }
}
