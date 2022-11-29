import url from 'node:url'
import { createReadStream } from 'node:fs'
import path from 'node:path'

import FormData from 'form-data'
import ProxyAgent from 'proxy-agent'
import fetch from 'node-fetch'

/**
 * Create a proxy agent to use wih HTTP requests
 * @param {'http' | 'https'} protocol - The protocol to use
 * @param {String} host - The host
 * @param {Number} port - The port
 * @param {String} username - The username
 * @param {String} password - The decrypted password
 * @returns {ProxyAgent.ProxyAgent} - The ProxyAgent to use
 */
const createProxyAgent = (protocol, host, port, username, password) => {
  const proxyOptions = url.parse(`${protocol}://${host}:${port}`)

  if (username && password) {
    proxyOptions.auth = `${username}:${password}`
  }

  return new ProxyAgent(proxyOptions)
}

/**
 * Mutate the headers to add authentication headers according to the type of authentication
 * @param {Object} headers - The headers to save the authentication
 * @param {'Basic' | 'API Key' | 'Bearer'} type - The type of authentication
 * @param {String} key - The key
 * @param {String} secret - The decrypted secret
 * @return {void}
 */
const addAuthenticationToHeaders = (headers, type, key, secret) => {
  switch (type) {
    case 'Basic':
      headers.Authorization = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`
      break

    case 'API Key':
      headers[key] = secret
      break

    case 'Bearer':
      headers.Authorization = `Bearer ${secret}`
      break

    default:
      throw new Error(`Unrecognized authentication type: "${type}".`)
  }
}

/**
 * Send the request using node-fetch
 * If "headers" contains Content-Type "data" is sent as string in the body.
 * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
 * @param {String} requestUrl - The URL to send the request to
 * @param {String} method - The request type
 * @param {Object} headers - Headers to send
 * @param {String} data - The body or file to send
 * @param {Number} timeout - The timeout in seconds
 * @param {Object} proxyAgent - Proxy to use
 * @return {Promise<void>} - The result promise
 */
const httpSend = async (
  requestUrl,
  method,
  headers,
  data,
  timeout,
  proxyAgent,
) => {
  let body
  let readStream
  if (Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
    body = data
  } else {
    readStream = createReadStream(data)
    body = new FormData()

    // Remove timestamp from the file path
    const { name, ext } = path.parse(data)
    const filename = name.slice(0, name.lastIndexOf('-'))

    const bodyOptions = { filename: `${filename}${ext}` }
    body.append('file', readStream, bodyOptions)

    const formHeaders = body.getHeaders()
    Object.keys(formHeaders).forEach((key) => {
      headers[key] = formHeaders[key]
    })
  }

  const fetchOptions = {
    method,
    headers,
    body,
    timeout: timeout * 1000,
  }
  if (proxyAgent) {
    fetchOptions.agent = proxyAgent
  }

  let response
  try {
    response = await fetch(requestUrl, fetchOptions)
  } catch (error) {
    readStream?.close()
    const requestError = error
    requestError.responseError = false
    throw requestError
  }
  readStream?.close()
  if (!response.ok) {
    const responseError = new Error(response.statusText)
    responseError.responseError = true
    responseError.statusCode = response.status
    throw responseError
  }
}

export {
  createProxyAgent,
  addAuthenticationToHeaders,
  httpSend,
}
