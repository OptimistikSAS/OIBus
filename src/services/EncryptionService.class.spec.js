const fs = require('fs')
const crypto = require('crypto')

const EncryptionService = require('./EncryptionService.class')

beforeEach(() => {
  jest.resetAllMocks()
  jest.restoreAllMocks()
})

describe('Encryption service', () => {
  const keyFolder = './tests/testKeys'
  const encryptionService = new EncryptionService()
  encryptionService.setKeyFolder(keyFolder)

  it('should not create key folder if exists', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'mkdirSync')
    fs.writeFileSync = jest.fn()

    encryptionService.checkOrCreatePrivateKey()

    expect(fs.mkdirSync).not.toBeCalled()
  })

  it('should create key folder if does not exist', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    fs.mkdirSync = jest.fn()
    fs.writeFileSync = jest.fn()

    encryptionService.checkOrCreatePrivateKey()

    expect(fs.mkdirSync).toBeCalledWith(keyFolder, { recursive: true })
  })

  it('should not create private and public keys if exist', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'writeFileSync')
    fs.writeFileSync = jest.fn()

    encryptionService.checkOrCreatePrivateKey()

    expect(fs.writeFileSync).not.toBeCalled()
  })

  it('should create private and public keys if they do not exist', async () => {
    const privateKey = 'private key'
    const publicKey = 'public key'

    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    jest.spyOn(crypto, 'generateKeyPairSync').mockImplementation((_type, _option) => ({ privateKey, publicKey }))
    fs.writeFileSync = jest.fn()

    encryptionService.checkOrCreatePrivateKey()

    expect(crypto.generateKeyPairSync).toBeCalled()
    expect(fs.writeFileSync).toBeCalledTimes(2)
  })

  it('should encrypt/decrypt text', async () => {
    const textToEncrypt = 'text to encrypt'

    const encryptedText = encryptionService.encryptText(textToEncrypt)
    const decryptedText = encryptionService.decryptText(encryptedText)

    expect(decryptedText).toEqual(textToEncrypt)
  })

  it('should encrypt/decrypt secrets', async () => {
    const objectToEncrypt = {
      key1: 'key1',
      password: '{{notEncrypted}}password',
      object1: {
        key2: 'key2',
        secretKey: '{{notEncrypted}}secretKey',
      },
    }
    const decryptedObject = {
      key1: 'key1',
      password: 'password',
      object1: {
        key2: 'key2',
        secretKey: 'secretKey',
      },
    }

    encryptionService.encryptSecrets(objectToEncrypt)
    encryptionService.decryptSecrets(objectToEncrypt)

    expect(decryptedObject).toEqual(objectToEncrypt)
  })
})
