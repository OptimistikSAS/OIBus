const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const Logger = require('../engine/Logger.class')

const logger = new Logger('encryption')

/**
 * Check if private/public keys exist and create them if not.
 * @param {string} keyFolder - The folder to store the keys
 * @returns {void}
 */
const checkOrCreatePrivateKey = (keyFolder) => {
  const privateKeyPath = path.join(keyFolder, 'private.pem')
  const publicKeyPath = path.join(keyFolder, 'public.pem')

  if (!fs.existsSync(keyFolder)) {
    fs.mkdirSync(keyFolder, { recursive: true })
  }

  try {
    if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
      logger.warn('Private or Public key file was not found => creating a new pair')
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
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
  } catch (error) {
    logger.error(`Error creating key files: ${error.message}`)
  }
}

/**
 * Encrypt text.
 * @param {string} text - The text to encrypt
 * @param {string} keyFolder - The folder where the keys are stored
 * @return {string} - The encrypted text
 */
const encryptText = (text, keyFolder) => {
  const absolutePath = path.resolve(path.join(keyFolder, 'public.pem'))
  const publicKey = fs.readFileSync(absolutePath, 'utf8')
  const buffer = Buffer.from(text, 'utf8')
  const encrypted = crypto.publicEncrypt(publicKey, buffer)
  return encrypted.toString('base64')
}

/**
 * Decrypt text.
 * @param {string} text - The text to decrypt
 * @param {string} keyFolder - The folder where the keys are stored
 * @return {string|null} - The decrypted text
 */
const decryptText = (text, keyFolder) => {
  try {
    const absolutePath = path.resolve(path.join(keyFolder, 'private.pem'))
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
  } catch (error) {
    logger.error(`Error in decryption: ${error.message}`)
    return null
  }
}

/**
 * Recursively iterate through an object tree and encrypt sensitive fields.
 * @param {object} configEntry - The object to iterate through
 * @param {string} keyFolder - The folder where the keys are stored
 * @returns {void}
 */
const encryptSecrets = (configEntry, keyFolder) => {
  try {
    if (configEntry) {
      Object.entries(configEntry).forEach(([key, value]) => {
        if (typeof value === 'object') {
          encryptSecrets(value, keyFolder)
        } else if (['password', 'secretKey'].includes(key) && value.startsWith('{{notEncrypted}}')) {
          configEntry[key] = encryptText(value.replace('{{notEncrypted}}', ''), keyFolder)
        }
      })
    }
  } catch (error) {
    logger.error(new Error(`Error in encryption: ${error.message}`))
    throw (error)
  }
}

/**
 * Recursively iterate through an object tree and decrypt sensitive fields.
 * @param {object} configEntry - The object to iterate through
 * @param {string} keyFolder - The folder where the keys are stored
 * @returns {void}
 */
const decryptSecrets = (configEntry, keyFolder) => {
  if (configEntry) {
    Object.entries(configEntry).forEach(([key, value]) => {
      if (typeof value === 'object') {
        decryptSecrets(value, keyFolder)
      } else if (['password', 'secretKey'].includes(key)) {
        configEntry[key] = decryptText(value, keyFolder)
      }
    })
  }
}

module.exports = {
  checkOrCreatePrivateKey,
  encryptText,
  decryptText,
  encryptSecrets,
  decryptSecrets,
}
