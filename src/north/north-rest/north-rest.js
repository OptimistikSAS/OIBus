import objectMapper from 'object-mapper'
import NorthConnector from '../north-connector.js'
import { httpSend, addAuthenticationToHeaders } from '../../service/http-request-static-functions.js'
import manifest from './manifest.js'

/**
 * Class NorthRest - Send data to RestAPI
 */
export default class NorthRest extends NorthConnector {
  static category = manifest.category

  /**
   * Constructor for NorthRestAPI
   * @constructor
   * @param {Object} configuration - The North connector configuration
   * @param {ProxyService} proxyService - The proxy service
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxyService,
    logger,
  ) {
    super(
      configuration,
      proxyService,
      logger,
      manifest,
    )

    const {
      url,
      requestMethod,
      authType,
      user,
      password,
      secret,
      headers,
      map,
    } = configuration.settings
    this.url = url
    this.authType = authType
    this.requestMethod = requestMethod
    this.user = user
    this.password = password
    this.secret = secret
    this.headers = headers
    this.map = map
  }

  /**
   * Handle values by sending them to RestApi
   * @param {Object[]} values - The values to send
   * @returns {Promise<void>} - The result promise
   */
  async handleValues(values) {
    // Get key and secret for authentication header.
    const key = this.authType === 'Basic' ? this.user : ''
    const secret = this.authType === 'Basic'
      ? await this.encryptionService.decryptText(this.password)
      : await this.encryptionService.decryptText(this.secret)
    const headers = this.headers.reduce((accu, h) => ({ ...accu, [h.key]: h.value }), {})
    addAuthenticationToHeaders(headers, this.authType, key, secret)
    // Parse object map to json format.
    const mapping = JSON.parse(this.map)
    // if object mapping is an empty object, send values as they are.
    const body = mapping !== {} ? objectMapper(values, mapping) : values
    // Send the request to api
    await httpSend(
      this.url,
      this.requestMethod,
      headers,
      JSON.stringify(body),
      this.cacheSettings.timeout,
      null,
    )
  }
}
