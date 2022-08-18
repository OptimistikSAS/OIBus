import path from 'node:path'
import fs from 'node:fs/promises'

const mkdir = async (folderPath) => {
  try {
    await fs.stat(folderPath)
  } catch (error) {
    await fs.mkdir(folderPath, { recursive: true })
  }
}

const MAX_NUMBER_OF_NODE_TO_LOG = 10

/**
 * @param {string} certFolder - the cert folder path
 * @returns {Promise<void>} - The resolved promise when the files are copied
 */
const initOpcuaCertificateFolders = async (certFolder) => {
  const rootFolder = `${certFolder}/opcua`
  await mkdir(path.join(rootFolder, 'own'))
  await mkdir(path.join(rootFolder, 'own/certs'))
  await mkdir(path.join(rootFolder, 'own/private'))
  await mkdir(path.join(rootFolder, 'rejected'))
  await mkdir(path.join(rootFolder, 'trusted'))
  await mkdir(path.join(rootFolder, 'trusted/certs'))
  await mkdir(path.join(rootFolder, 'trusted/crl'))

  await mkdir(path.join(rootFolder, 'issuers'))
  await mkdir(path.join(rootFolder, 'issuers/certs')) // contains Trusted CA certificates
  await mkdir(path.join(rootFolder, 'issuers/crl')) // contains CRL of revoked CA certificates

  await fs.copyFile(`${certFolder}/privateKey.pem`, `${rootFolder}/own/private/private_key.pem`)
  await fs.copyFile(`${certFolder}/cert.pem`, `${rootFolder}/own/certs/client_certificate.pem`)
  await fs.copyFile(`${certFolder}/cert.pem`, `${rootFolder}/trusted/certs/oibus_client.pem`)
}

export { initOpcuaCertificateFolders, MAX_NUMBER_OF_NODE_TO_LOG }
