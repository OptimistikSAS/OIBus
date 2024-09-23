import os from 'node:os';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import selfSigned, { GenerateResult } from 'selfsigned';

import { createFolder, filesExists } from './utils';
import { OibFormControl } from '../../../shared/model/form.model';
import { CryptoSettings } from '../../../shared/model/engine.model';
import { CertificateOptions } from '../../../shared/model/certificate.model';

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
      const certificate = this.generateSelfSignedCertificate({
        commonName: 'OIBus',
        countryName: 'FR',
        stateOrProvinceName: 'Savoie',
        localityName: 'Chambery',
        organizationName: 'Optimistik',
        keySize: 4096,
        daysBeforeExpiry: 36500
      });
      await fs.writeFile(this.getPrivateKeyPath(), certificate.private);
      await fs.writeFile(this.getPublicKeyPath(), certificate.public);
      await fs.writeFile(this.getCertPath(), certificate.cert);
    }
  }

  generateSelfSignedCertificate(options: CertificateOptions): GenerateResult {
    return selfSigned.generate(
      [
        { name: 'commonName', value: options.commonName },
        { name: 'countryName', value: options.countryName },
        { name: 'stateOrProvinceName', value: options.stateOrProvinceName },
        { name: 'localityName', value: options.localityName },
        { name: 'organizationName', value: options.organizationName }
      ],
      {
        keySize: options.keySize,
        days: options.daysBeforeExpiry,
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
  }

  async encryptConnectorSecrets<T>(newSettings: T, oldSettings: T | null, formSettings: Array<OibFormControl>): Promise<T> {
    const encryptedSettings: Record<string, string | object | Array<object>> = JSON.parse(JSON.stringify(newSettings)) as Record<
      string,
      string | object | Array<object>
    >;

    const previousSettings: Record<string, string | object | Array<object>> | null = oldSettings
      ? (JSON.parse(JSON.stringify(oldSettings)) as Record<string, string | object | Array<object>>)
      : null;

    for (const fieldSettings of formSettings) {
      if (fieldSettings.type === 'OibSecret') {
        if (encryptedSettings[fieldSettings.key]) {
          encryptedSettings[fieldSettings.key] = await this.encryptText(encryptedSettings[fieldSettings.key] as string);
        } else {
          encryptedSettings[fieldSettings.key] = previousSettings ? (previousSettings[fieldSettings.key] as string) || '' : '';
        }
      } else if (fieldSettings.type === 'OibArray' && encryptedSettings[fieldSettings.key]) {
        for (let i = 0; i < (encryptedSettings[fieldSettings.key] as Array<object>).length; i++) {
          (encryptedSettings[fieldSettings.key] as Array<object>)[i] = await this.encryptConnectorSecrets<object>(
            (encryptedSettings[fieldSettings.key] as Array<object>)[i],
            previousSettings && previousSettings[fieldSettings.key] && Array.isArray(previousSettings[fieldSettings.key])
              ? (previousSettings[fieldSettings.key] as Array<object>)[i]
              : null,
            fieldSettings.content
          );
        }
      } else if (fieldSettings.type === 'OibFormGroup' && encryptedSettings[fieldSettings.key]) {
        encryptedSettings[fieldSettings.key] = await this.encryptConnectorSecrets<object>(
          encryptedSettings[fieldSettings.key] as object,
          previousSettings ? (previousSettings[fieldSettings.key] as object) || null : null,
          fieldSettings.content
        );
      }
    }
    return encryptedSettings as T;
  }

  filterSecrets<T>(connectorSettings: T, formSettings: Array<OibFormControl>): T {
    const previousSettings: Record<string, string | object | Array<object>> | null = JSON.parse(
      JSON.stringify(connectorSettings)
    ) as Record<string, string | object | Array<object>>;
    for (const fieldSettings of formSettings) {
      if (fieldSettings.type === 'OibSecret') {
        previousSettings[fieldSettings.key] = '';
      } else if (fieldSettings.type === 'OibArray' && previousSettings[fieldSettings.key]) {
        for (let i = 0; i < (previousSettings[fieldSettings.key] as Array<object>).length; i++) {
          (previousSettings[fieldSettings.key] as Array<object>)[i] = this.filterSecrets(
            (previousSettings[fieldSettings.key] as Array<object>)[i],
            fieldSettings.content
          );
        }
      } else if (fieldSettings.type === 'OibFormGroup' && previousSettings[fieldSettings.key]) {
        previousSettings[fieldSettings.key] = this.filterSecrets<object>(
          previousSettings[fieldSettings.key] as object,
          fieldSettings.content
        );
      }
    }
    return previousSettings as T;
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
