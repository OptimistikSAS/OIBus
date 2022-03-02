const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

class EncryptionService {
  static getInstance() {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService()
    }
    return EncryptionService.instance
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
      },
      buffer,
    )
    return decrypted.toString('utf8')
  }
}

module.exports = EncryptionService
