const os = require('os')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const selfSigned = require('selfsigned')

class EncryptionService {
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
   * Set the key folder.
   * @param {string} keyFolder - The folder to store the keys
   * @returns {void}
   */
  setKeyFolder(keyFolder) {
    this.keyFolder = keyFolder
  }

  /**
   * Set the cert folder.
   * @param {string} certsFolder - The folder to store the keys
   * @returns {void}
   */
  setCertsFolder(certsFolder) {
    this.certsFolder = certsFolder
  }

  /**
   * Check if local certificates exist and create them if not.
   * @returns {void}
   */
  checkOrCreateCertFiles() {
    const privateKeyPath = path.join(this.certsFolder, 'privateKey.pem')
    const publicKeyPath = path.join(this.certsFolder, 'publicKey.pem')
    const certPath = path.join(this.certsFolder, 'cert.pem')
    if (!fs.existsSync(this.certsFolder)) {
      fs.mkdirSync(this.certsFolder, { recursive: true })
    }
    if (
      !fs.existsSync(privateKeyPath)
        || !fs.existsSync(publicKeyPath)
        || !fs.existsSync(certPath)
    ) {
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

      fs.writeFileSync(privateKeyPath, certificate.private)
      fs.writeFileSync(publicKeyPath, certificate.public)
      fs.writeFileSync(certPath, certificate.cert)
    }
  }

  /**
   * Check if private/public keys exist and create them if not.
   * @returns {void}
   */
  checkOrCreatePrivateKey() {
    const privateKeyPath = path.join(this.keyFolder, 'private.pem')
    const publicKeyPath = path.join(this.keyFolder, 'public.pem')

    if (!fs.existsSync(this.keyFolder)) {
      fs.mkdirSync(this.keyFolder, { recursive: true })
    }

    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
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

      fs.writeFileSync(privateKeyPath, privateKey)
      fs.writeFileSync(publicKeyPath, publicKey)
    }
  }

  /**
   * Recursively iterate through an object tree and encrypt sensitive fields.
   * @param {object} configEntry - The object to iterate through
   * @returns {void}
   */
  encryptSecrets(configEntry) {
    if (configEntry) {
      Object.entries(configEntry).forEach(([key, value]) => {
        if (typeof value === 'object') {
          this.encryptSecrets(value)
        } else if (['password', 'secretKey', 'token'].includes(key) && value.startsWith('{{notEncrypted}}')) {
          configEntry[key] = this.encryptText(value.replace('{{notEncrypted}}', ''))
        }
      })
    }
  }

  /**
   * Encrypt text.
   * @param {string} text - The text to encrypt
   * @return {string} - The encrypted text
   */
  encryptText(text) {
    const absolutePath = path.resolve(path.join(this.keyFolder, 'public.pem'))
    const publicKey = fs.readFileSync(absolutePath, 'utf8')
    const buffer = Buffer.from(text, 'utf8')
    const encrypted = crypto.publicEncrypt(publicKey, buffer)
    return encrypted.toString('base64')
  }

  /**
   * Recursively iterate through an object tree and decrypt sensitive fields.
   * @param {object} configEntry - The object to iterate through
   * @returns {void}
   */
  decryptSecrets(configEntry) {
    if (configEntry) {
      Object.entries(configEntry)
        .forEach(([key, value]) => {
          if (typeof value === 'object') {
            this.decryptSecrets(value)
          } else if (['password', 'secretKey'].includes(key)) {
            configEntry[key] = this.decryptText(value)
          }
        })
    }
  }

  /**
   * Decrypt text.
   * @param {string} text - The text to decrypt
   * @return {string|null} - The decrypted text
   */
  decryptText(text) {
    const absolutePath = path.resolve(path.join(this.keyFolder, 'private.pem'))
    const privateKey = fs.readFileSync(absolutePath, 'utf8')
    const buffer = Buffer.from(text, 'base64')
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

module.exports = EncryptionService
