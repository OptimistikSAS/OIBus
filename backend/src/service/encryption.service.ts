import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { DateTime } from 'luxon';
import * as forge from 'node-forge';

import { CertificateOptions } from '../../shared/model/api/certificate.model';
import { OIBusObjectAttribute } from '../../shared/model/connector/form.model';
import { CryptoSettings } from '../../shared/model/domain/engine.model';

import { filesExists } from './utils';

export const CERT_PRIVATE_KEY_FILE_NAME = 'private.pem';
export const CERT_PUBLIC_KEY_FILE_NAME = 'public.pem';
export const CERT_FILE_NAME = 'cert.pem';

const SECRET_ENCRYPTION_ALGORITHM = 'aes-256-gcm';
// An encrypted secret is the base64 of nonce | ciphertext | authentication tag
const NONCE_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
/**
 * HKDF context of the AES-256-GCM key, derived from the stored key: before OIBus 4.0, the stored key itself encrypted the
 * secrets with AES-256-CBC, and a key must not be used with two modes
 */
const SECRET_KEY_INFO = 'oibus-secret-encryption-aes-256-gcm';

/**
 * Derive the AES-256-GCM key of the secrets from the key stored in crypto.db (base64)
 */
const deriveSecretKey = (securityKey: string): Buffer =>
  Buffer.from(crypto.hkdfSync('sha256', Buffer.from(securityKey, 'base64'), Buffer.alloc(0), SECRET_KEY_INFO, 32));

interface CryptoSettingsInternal {
  /** AES-256-GCM key of the secrets */
  key: Buffer;
}

/**
 * Service used to manage encryption and decryption of secrets in the config file
 * Also responsible to create private and public key used for encrypting the secrets
 */
export default class EncryptionService<TInitialized extends boolean = false> {
  private static instance: EncryptionService | null = null;
  private initialized = false;
  private _cryptoSettings: CryptoSettingsInternal | null = null;
  private _certsFolder = ''; // resolved path of cert folders, passed from the init call
  private _publicKey: string | null = null;
  private _privateKey: string | null = null;
  private _certFile: string | null = null;

  get cryptoSettings() {
    return this._cryptoSettings as TInitialized extends true ? CryptoSettingsInternal : CryptoSettingsInternal | null;
  }

  get certsFolder() {
    return this._certsFolder;
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new EncryptionService();
    }

    return this.instance;
  }

  isInitialized(): this is EncryptionService<true> {
    return this.initialized;
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

  async init(cryptoSettings: CryptoSettings, certsFolder: string) {
    this._certsFolder = certsFolder;
    this._cryptoSettings = { key: deriveSecretKey(cryptoSettings.securityKey) };

    // Created for the user running OIBus only, like the private key (an existing folder is left as it is)
    await fs.mkdir(this._certsFolder, { recursive: true, mode: 0o700 });

    if (
      !(await filesExists(this.getCertPath())) ||
      !(await filesExists(this.getPrivateKeyPath())) ||
      !(await filesExists(this.getPublicKeyPath()))
    ) {
      const certificate = await this.generateSelfSignedCertificate({
        commonName: 'OIBus',
        countryName: 'FR',
        stateOrProvinceName: 'Savoie',
        localityName: 'Chambery',
        organizationName: 'Optimistik',
        keySize: 4096,
        daysBeforeExpiry: 36500
      });
      await fs.writeFile(this.getPrivateKeyPath(), certificate.private, { mode: 0o600 });
      await fs.writeFile(this.getPublicKeyPath(), certificate.public);
      await fs.writeFile(this.getCertPath(), certificate.cert);
    }

    this.initialized = true;
  }

  generateSelfSignedCertificate(options: CertificateOptions): { private: string; public: string; cert: string } {
    // 1. Generate Key Pair (RSA)
    const keys = forge.pki.rsa.generateKeyPair(options.keySize);

    // 2. Create Certificate
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;

    // 3. Set Serial Number (random hex)
    cert.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(19));

    // 4. Set Validity
    const now = new Date();
    cert.validity.notBefore = now;
    cert.validity.notAfter = DateTime.now().plus({ days: options.daysBeforeExpiry }).toJSDate();

    // 5. Set Attributes (Subject & Issuer are the same for self-signed)
    const attrs = [
      { shortName: 'CN', value: options.commonName },
      { shortName: 'C', value: options.countryName },
      { shortName: 'ST', value: options.stateOrProvinceName },
      { shortName: 'L', value: options.localityName },
      { shortName: 'O', value: options.organizationName }
    ].filter(attr => attr.value && attr.value.trim() !== '');

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // 6. Set Extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false,
        critical: true
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
        serverAuth: true,
        clientAuth: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 6, // 6 = URI (Uniform Resource Identifier)
            value: `urn:${os.hostname()}:OIBus`
          },
          {
            type: 2, // 2 = DNS
            value: os.hostname()
          }
        ]
      }
    ]);

    // 7. Self-Sign the Certificate
    // SHA-256 is standard for OPC UA
    cert.sign(keys.privateKey, forge.md.sha256.create());

    // 8. Export to PEM format
    return {
      private: forge.pki.privateKeyToPem(keys.privateKey),
      public: forge.pki.publicKeyToPem(keys.publicKey),
      cert: forge.pki.certificateToPem(cert)
    };
  }

  async encryptConnectorSecrets<T>(newSettings: T, oldSettings: T | null, formSettings: OIBusObjectAttribute): Promise<T> {
    const encryptedSettings: Record<string, string | object | Array<object>> = JSON.parse(JSON.stringify(newSettings)) as Record<
      string,
      string | object | Array<object>
    >;

    const previousSettings: Record<string, string | object | Array<object>> | null = oldSettings
      ? (JSON.parse(JSON.stringify(oldSettings)) as Record<string, string | object | Array<object>>)
      : null;

    for (const fieldSettings of formSettings.attributes) {
      if (fieldSettings.type === 'secret') {
        if (encryptedSettings[fieldSettings.key]) {
          encryptedSettings[fieldSettings.key] = await this.encryptText(encryptedSettings[fieldSettings.key] as string);
        } else {
          encryptedSettings[fieldSettings.key] = previousSettings ? (previousSettings[fieldSettings.key] as string) || '' : '';
        }
      } else if (fieldSettings.type === 'array' && encryptedSettings[fieldSettings.key]) {
        for (let i = 0; i < (encryptedSettings[fieldSettings.key] as Array<object>).length; i++) {
          (encryptedSettings[fieldSettings.key] as Array<object>)[i] = await this.encryptConnectorSecrets<object>(
            (encryptedSettings[fieldSettings.key] as Array<object>)[i],
            previousSettings && previousSettings[fieldSettings.key] && Array.isArray(previousSettings[fieldSettings.key])
              ? (previousSettings[fieldSettings.key] as Array<object>)[i]
              : null,
            fieldSettings.rootAttribute
          );
        }
      } else if (fieldSettings.type === 'object' && encryptedSettings[fieldSettings.key]) {
        encryptedSettings[fieldSettings.key] = await this.encryptConnectorSecrets<object>(
          encryptedSettings[fieldSettings.key] as object,
          previousSettings ? (previousSettings[fieldSettings.key] as object) || null : null,
          fieldSettings
        );
      }
    }
    return encryptedSettings as T;
  }

  async decryptConnectorSecrets<T>(newSettings: T, formSettings: OIBusObjectAttribute): Promise<T> {
    const decryptedSettings: Record<string, string | object | Array<object>> = JSON.parse(JSON.stringify(newSettings)) as Record<
      string,
      string | object | Array<object>
    >;

    for (const fieldSettings of formSettings.attributes) {
      if (fieldSettings.type === 'secret') {
        decryptedSettings[fieldSettings.key] = decryptedSettings[fieldSettings.key]
          ? await this.decryptText(decryptedSettings[fieldSettings.key] as string)
          : '';
      } else if (fieldSettings.type === 'array' && decryptedSettings[fieldSettings.key]) {
        for (let i = 0; i < (decryptedSettings[fieldSettings.key] as Array<object>).length; i++) {
          (decryptedSettings[fieldSettings.key] as Array<object>)[i] = await this.decryptConnectorSecrets<object>(
            (decryptedSettings[fieldSettings.key] as Array<object>)[i],
            fieldSettings.rootAttribute
          );
        }
      } else if (fieldSettings.type === 'object' && decryptedSettings[fieldSettings.key]) {
        decryptedSettings[fieldSettings.key] = await this.decryptConnectorSecrets<object>(
          decryptedSettings[fieldSettings.key] as object,
          fieldSettings
        );
      }
    }
    return decryptedSettings as T;
  }

  filterSecrets<T>(connectorSettings: T, formSettings: OIBusObjectAttribute): T {
    const previousSettings: Record<string, string | object | Array<object>> | null = JSON.parse(
      JSON.stringify(connectorSettings)
    ) as Record<string, string | object | Array<object>>;
    for (const fieldSettings of formSettings.attributes) {
      if (fieldSettings.type === 'secret') {
        previousSettings[fieldSettings.key] = '';
      } else if (fieldSettings.type === 'array' && previousSettings[fieldSettings.key]) {
        for (let i = 0; i < (previousSettings[fieldSettings.key] as Array<object>).length; i++) {
          (previousSettings[fieldSettings.key] as Array<object>)[i] = this.filterSecrets(
            (previousSettings[fieldSettings.key] as Array<object>)[i],
            fieldSettings.rootAttribute
          );
        }
      } else if (fieldSettings.type === 'object' && previousSettings[fieldSettings.key]) {
        previousSettings[fieldSettings.key] = this.filterSecrets<object>(previousSettings[fieldSettings.key] as object, fieldSettings);
      }
    }
    return previousSettings as T;
  }

  /**
   * Returns the text encrypted with AES-256-GCM and a random nonce, or an empty string when the parameter is falsy
   */
  encryptText(plainText?: string | null): string {
    if (!this.isInitialized()) {
      throw Error('EncryptionService not initialized');
    }

    // Manage empty strings
    if (!plainText) {
      return '';
    }

    const nonce = crypto.randomBytes(NONCE_LENGTH);
    const cipher = crypto.createCipheriv(SECRET_ENCRYPTION_ALGORITHM, this.cryptoSettings.key, nonce, { authTagLength: AUTH_TAG_LENGTH });
    const encryptedData = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    return Buffer.concat([nonce, encryptedData, cipher.getAuthTag()]).toString('base64');
  }

  /**
   * Returns the decrypted text or an empty string when the parameter is falsy. Throws when the text was altered.
   */
  decryptText(encryptedText?: string | null): string {
    if (!this.isInitialized()) {
      throw Error('EncryptionService not initialized');
    }

    // Manage empty strings
    if (!encryptedText) {
      return '';
    }

    const data = Buffer.from(encryptedText, 'base64');
    if (data.length < NONCE_LENGTH + AUTH_TAG_LENGTH) {
      throw Error('Invalid encrypted text');
    }
    const decipher = crypto.createDecipheriv(SECRET_ENCRYPTION_ALGORITHM, this.cryptoSettings.key, data.subarray(0, NONCE_LENGTH), {
      authTagLength: AUTH_TAG_LENGTH
    });
    decipher.setAuthTag(data.subarray(data.length - AUTH_TAG_LENGTH));
    return Buffer.concat([decipher.update(data.subarray(NONCE_LENGTH, data.length - AUTH_TAG_LENGTH)), decipher.final()]).toString('utf8');
  }

  /**
   * Decrypt a text encrypted by OIAnalytics with the public key of OIBus. The private keys are tried in turn: the text may
   * have been encrypted with the public key replaced by the last key rotation.
   * @param privateKeys the current private key, then the previous one if any
   */
  decryptTextWithPrivateKey(encryptedText: string, privateKeys: Array<string>): string {
    let lastError: unknown = new Error('No private key to decrypt the text');
    for (const privateKey of privateKeys) {
      try {
        return crypto
          .privateDecrypt(
            {
              key: privateKey,
              padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
              oaepHash: 'sha256'
            },
            Buffer.from(encryptedText, 'base64')
          )
          .toString();
      } catch (error: unknown) {
        lastError = error;
      }
    }
    throw lastError;
  }

  async decryptSecretsWithPrivateKey<T>(newSettings: T, formSettings: OIBusObjectAttribute, privateKeys: Array<string>): Promise<T> {
    const encryptedSettings: Record<string, string | object | Array<object>> = JSON.parse(JSON.stringify(newSettings)) as Record<
      string,
      string | object | Array<object>
    >;

    for (const fieldSettings of formSettings.attributes) {
      if (fieldSettings.type === 'secret') {
        if (encryptedSettings[fieldSettings.key]) {
          encryptedSettings[fieldSettings.key] = await this.decryptTextWithPrivateKey(
            encryptedSettings[fieldSettings.key] as string,
            privateKeys
          );
        } else {
          encryptedSettings[fieldSettings.key] = '';
        }
      } else if (fieldSettings.type === 'array' && encryptedSettings[fieldSettings.key]) {
        for (let i = 0; i < (encryptedSettings[fieldSettings.key] as Array<object>).length; i++) {
          (encryptedSettings[fieldSettings.key] as Array<object>)[i] = await this.decryptSecretsWithPrivateKey<object>(
            (encryptedSettings[fieldSettings.key] as Array<object>)[i],
            fieldSettings.rootAttribute,
            privateKeys
          );
        }
      } else if (fieldSettings.type === 'object' && encryptedSettings[fieldSettings.key]) {
        encryptedSettings[fieldSettings.key] = await this.decryptSecretsWithPrivateKey<object>(
          encryptedSettings[fieldSettings.key] as object,
          fieldSettings,
          privateKeys
        );
      }
    }
    return encryptedSettings as T;
  }
}

export const encryptionService = EncryptionService.getInstance();
