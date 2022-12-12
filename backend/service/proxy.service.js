import { createProxyAgent } from './http-request-static-functions.js'

/**
 * This service manage proxies for use in north or south connectors
 */
export default class ProxyService {
  /**
   * Constructor for ProxyService class
   * @param {Object[]} proxies - The proxy list
   * @param {EncryptionService} encryptionService - The encryption service
   * @return {void}
   */
  constructor(proxies, encryptionService) {
    this.proxies = proxies
    this.encryptionService = encryptionService
  }

  /**
   * Get proxy by name
   * @param {String} proxyName - The name of the proxy
   * @param {Boolean} acceptUnauthorized - Reject unauthorized certificate
   * @return {Promise<Object>} - The proxy
   */
  async getProxy(proxyName, acceptUnauthorized = false) {
    const foundProxy = this.proxies.find(({ name }) => name === proxyName)
    if (foundProxy) {
      return createProxyAgent(
        foundProxy.protocol,
        foundProxy.host,
        foundProxy.port,
        foundProxy.username,
        await this.encryptionService.decryptText(foundProxy.password || ''),
        acceptUnauthorized,
      )
    }
    return null
  }
}
