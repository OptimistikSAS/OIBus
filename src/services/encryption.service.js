const crypto = require('crypto')

const ALGORITHM = 'aes256'
const ENCRYPTION_KEY = 'lopicsa'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const ENCODING = 'hex'
const SEPARATOR = ':'

/**
 * Encrypt text.
 * @param {string} text - The text to encrypt
 * @return {string} - The encrypted text
 */
const encrypt = (text) => {
  let key = Buffer.alloc(KEY_LENGTH)
  key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], key.length)

  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(text), cipher.final()])

  return `${iv.toString(ENCODING)}${SEPARATOR}${encrypted.toString(ENCODING)}`
}

/**
 * Decrypt text.
 * @param {string} text - The text to decrypt
 * @return {string} - The decrypted text
 */
const decrypt = (text) => {
  let key = Buffer.alloc(KEY_LENGTH)
  key = Buffer.concat([Buffer.from(ENCRYPTION_KEY)], key.length)

  const [ivText, encryptedText] = text.split(SEPARATOR)
  const iv = Buffer.from(ivText, ENCODING)
  const encrypted = Buffer.from(encryptedText, ENCODING)

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(key), iv)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

  return decrypted.toString()
}

module.exports = { encrypt, decrypt }
