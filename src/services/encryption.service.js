const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

/**
 * Check if private/public keys exist and create them if not.
 * @param {string} keyFolder - The folder to store the keys
 * @param {Logger} logger - logger
 * @returns {void}
 */
const checkOrCreatePrivateKey = (keyFolder, logger) => {
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
    logger.error(error)
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
 * @param {Logger} logger - The logger
 * @return {string} - The decrypted text
 */
const decryptText = (text, keyFolder, logger) => {
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
    logger.error(error)
    return ''
  }
}

/**
 * Recursively iterate through an object tree and encrypt sensitive fields.
 * @param {object} configEntry - The object to iterate through
 * @param {string} keyFolder - The folder where the keys are stored
 * @returns {void}
 */
const encryptSecrets = (configEntry, keyFolder) => {
  if (configEntry) {
    Object.entries(configEntry).forEach(([key, value]) => {
      if (typeof value === 'object') {
        encryptSecrets(value, keyFolder)
      } else if (['password', 'secretKey'].includes(key)) {
        configEntry[key] = encryptText(value, keyFolder)
      }
    })
  }
}

/**
 * Recursively iterate through an object tree and decrypt sensitive fields.
 * @param {object} configEntry - The object to iterate through
 * @param {string} keyFolder - The folder where the keys are stored
 * @param {Logger} logger - The logger
 * @returns {void}
 */
const decryptSecrets = (configEntry, keyFolder, logger) => {
  if (configEntry) {
    Object.entries(configEntry).forEach(([key, value]) => {
      if (typeof value === 'object') {
        decryptSecrets(value, keyFolder, logger)
      } else if (['password', 'secretKey'].includes(key)) {
        configEntry[key] = decryptText(value, keyFolder, logger)
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
