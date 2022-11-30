import path from 'node:path'
import fs from 'node:fs/promises'
import { createFolder } from './utils.js'

const MAX_NUMBER_OF_NODE_TO_LOG = 10

/**
 * @param {string} certFolder - the cert folder path
 * @returns {Promise<void>} - The result promise
 */
const initOpcuaCertificateFolders = async (certFolder) => {
  const rootFolder = `${certFolder}/opcua`
  await createFolder(path.join(rootFolder, 'own'))
  await createFolder(path.join(rootFolder, 'own/certs'))
  await createFolder(path.join(rootFolder, 'own/private'))
  await createFolder(path.join(rootFolder, 'rejected'))
  await createFolder(path.join(rootFolder, 'trusted'))
  await createFolder(path.join(rootFolder, 'trusted/certs'))
  await createFolder(path.join(rootFolder, 'trusted/crl'))

  await createFolder(path.join(rootFolder, 'issuers'))
  await createFolder(path.join(rootFolder, 'issuers/certs')) // contains Trusted CA certificates
  await createFolder(path.join(rootFolder, 'issuers/crl')) // contains CRL of revoked CA certificates

  await fs.copyFile(`${certFolder}/privateKey.pem`, `${rootFolder}/own/private/private_key.pem`)
  await fs.copyFile(`${certFolder}/cert.pem`, `${rootFolder}/own/certs/client_certificate.pem`)
  await fs.copyFile(`${certFolder}/cert.pem`, `${rootFolder}/trusted/certs/oibus_client.pem`)
}

export { initOpcuaCertificateFolders, MAX_NUMBER_OF_NODE_TO_LOG }
