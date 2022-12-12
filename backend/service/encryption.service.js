import os from 'node:os'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import selfSigned from 'selfsigned'

import { createFolder, filesExists } from './utils.js'

const CERT_PRIVATE_KEY_FILE_NAME = 'privateKey.pem'
const CERT_PUBLIC_KEY_FILE_NAME = 'publicKey.pem'
const CERT_FILE_NAME = 'cert.pem'

const OIBUS_PRIVATE_KEY_FILE_NAME = 'private.pem'
const OIBUS_PUBLIC_KEY_FILE_NAME = 'public.pem'

/**
 * Service used to manage encryption and decryption of secrets in the config file
 * Also responsible to create private and public key used for encrypting the secrets
 */
export default class EncryptionService {
  static getInstance() {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService()
    }
    return EncryptionService.instance
  }

  constructor() {
    this.keyFolder = null
    this.certsFolder = null
  }

  /**
   * Set the key folder path.
   * @param {String} keyFolder - The folder path to store the keys
   * @returns {void}
   */
  setKeyFolder(keyFolder) {
    this.keyFolder = keyFolder
  }

  /**
   * Set the cert folder path.
   * @param {String} certsFolder - The folder path to store the keys
   * @returns {void}
   */
  setCertsFolder(certsFolder) {
    this.certsFolder = certsFolder
  }

  /**
   * Check if local certificates exist and create them if not.
   * @returns {Promise<void>} - The result promise
   */
  async checkOrCreateCertFiles() {
    const privateKeyPath = path.resolve(this.certsFolder, CERT_PRIVATE_KEY_FILE_NAME)
    const publicKeyPath = path.resolve(this.certsFolder, CERT_PUBLIC_KEY_FILE_NAME)
    const certPath = path.resolve(this.certsFolder, CERT_FILE_NAME)
    await createFolder(this.certsFolder)

    if (!await filesExists(privateKeyPath) || !await filesExists(publicKeyPath) || !await filesExists(certPath)) {
      const certificate = selfSigned.generate([
        { name: 'commonName', value: 'OIBus' },
        { name: 'countryName', value: 'FR' },
        { name: 'stateOrProvinceName', value: 'Savoie' },
        { name: 'localityName', value: 'Chambery' },
        { name: 'organizationName', value: 'Optimistik' },
        { name: 'organizationalUnitName', value: 'R&D' },
      ], {
        keySize: 2048,
        days: 36500,
        algorithm: 'sha256',
        pkcs7: true,
        extensions: [
          {
            name: 'basicConstraints',
            cA: false,
          },
          {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true,
          },
          {
            name: 'extKeyUsage',
            clientAuth: true,
            serverAuth: true,
          },
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 6, // URI
                value: `urn:${os.hostname()}:OIBus`,
              },
              {
                type: 2, // DNS
                value: os.hostname(),
              },
            ],
          },
        ],
      })

      await fs.writeFile(privateKeyPath, certificate.private)
      await fs.writeFile(publicKeyPath, certificate.public)
      await fs.writeFile(certPath, certificate.cert)
    }
  }

  /**
   * Check if private/public keys exist and create them if not.
   * @returns {Promise<void>} - The result promise
   */
  async checkOrCreatePrivateKey() {
    const privateKeyPath = path.resolve(this.keyFolder, OIBUS_PRIVATE_KEY_FILE_NAME)
    const publicKeyPath = path.resolve(this.keyFolder, OIBUS_PUBLIC_KEY_FILE_NAME)

    await createFolder(this.keyFolder)

    if (!await filesExists(privateKeyPath) || !await filesExists(publicKeyPath)) {
      const {
        privateKey,
        publicKey,
      } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
          cipher: 'aes-256-cbc',
          passphrase: '',
        },
      })

      await fs.writeFile(privateKeyPath, privateKey)
      await fs.writeFile(publicKeyPath, publicKey)
    }
  }

  /**
   * Recursively iterate through an object tree and encrypt sensitive fields.
   * @param {object} configEntry - The object to iterate through
   * @returns {Promise<void>} - The result promise
   */
  async encryptSecrets(configEntry) {
    if (configEntry) {
      await Object.entries(configEntry).reduce((promise, [key, value]) => promise.then(
        async () => {
          if (typeof value === 'object') {
            await this.encryptSecrets(value)
          } else if (['password', 'secretKey', 'token', 'secret'].includes(key) && value.startsWith('{{notEncrypted}}')) {
            configEntry[key] = await this.encryptText(value.replace('{{notEncrypted}}', ''))
          }
        },
      ), Promise.resolve())
    }
  }

  /**
   * Return the encrypted text
   * @param {String} plainText - The text to encrypt
   * @return {Promise<String>} - The encrypted text
   */
  async encryptText(plainText) {
    const absolutePath = path.resolve(this.keyFolder, OIBUS_PUBLIC_KEY_FILE_NAME)
    const publicKey = await fs.readFile(absolutePath, 'utf8')
    const buffer = Buffer.from(plainText, 'utf8')
    const encrypted = crypto.publicEncrypt(publicKey, buffer)
    return encrypted.toString('base64')
  }

  /**
   * Return the decrypted text
   * @param {String} encryptedText - The text to decrypt
   * @return {Promise<String>} - The decrypted text
   */
  async decryptText(encryptedText) {
    const absolutePath = path.resolve(this.keyFolder, OIBUS_PRIVATE_KEY_FILE_NAME)
    const privateKey = await fs.readFile(absolutePath, 'utf8')
    const buffer = Buffer.from(encryptedText, 'base64')
    const decrypted = crypto.privateDecrypt(
      {
        key: privateKey.toString(),
        passphrase: '',
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      },
      buffer,
    )
    return decrypted.toString('utf8')
  }
}
