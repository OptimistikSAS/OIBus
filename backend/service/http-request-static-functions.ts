import { createReadStream } from 'node:fs';
import path from 'node:path';

import FormData from 'form-data';
import fetch from 'node-fetch';

import { Authentication } from '../../shared/model/engine.model';
import EncryptionService from './encryption.service';

export interface FetchError extends Error {
  responseError?: boolean;
  statusCode?: number;
}

/**
 * Mutate the headers to add authentication headers according to the type of authentication
 */
const addAuthenticationToHeaders = async (
  headers: any,
  authentication: Authentication,
  encryptionService: EncryptionService
): Promise<void> => {
  switch (authentication.type) {
    case 'basic':
      headers.Authorization = `Basic ${Buffer.from(
        `${authentication.username}:${await encryptionService.decryptText(authentication.password)}`
      ).toString('base64')}`;
      break;

    case 'api-key':
      if (!authentication.key) {
        throw new Error(`Authentication type API key needs a key.`);
      }
      headers[authentication.key] = await encryptionService.decryptText(authentication.secret);
      break;

    case 'bearer':
      headers.Authorization = `Bearer ${await encryptionService.decryptText(authentication.token)}`;
      break;

    case 'none':
    default:
      return;
  }
};

/**
 * Send the request using node-fetch
 * If "headers" contains Content-Type "data" is sent as string in the body.
 * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
 */
const httpSend = async (
  requestUrl: string,
  method: string,
  headers: any,
  data: string,
  timeout: number,
  proxyAgent: any
): Promise<void> => {
  let body;
  let readStream;
  if (Object.prototype.hasOwnProperty.call(headers, 'Content-Type')) {
    body = data;
  } else {
    readStream = createReadStream(data);
    body = new FormData();

    // Remove timestamp from the file path
    const { name, ext } = path.parse(data);
    const filename = name.slice(0, name.lastIndexOf('-'));

    const bodyOptions = { filename: `${filename}${ext}` };
    body.append('file', readStream, bodyOptions);

    const formHeaders = body.getHeaders();
    Object.keys(formHeaders).forEach(key => {
      headers[key] = formHeaders[key];
    });
  }

  const fetchOptions = {
    method,
    headers,
    body,
    timeout: timeout * 1000,
    agent: undefined
  };
  if (proxyAgent) {
    fetchOptions.agent = proxyAgent;
  }

  let response;
  try {
    response = await fetch(requestUrl, fetchOptions);
  } catch (error) {
    readStream?.close();
    const requestError: FetchError = error as Error;
    requestError.responseError = false;
    throw requestError;
  }
  readStream?.close();
  if (!response.ok) {
    const responseError: FetchError = new Error(response.statusText);
    responseError.responseError = true;
    responseError.statusCode = response.status;
    throw responseError;
  }
};

export { addAuthenticationToHeaders, httpSend };
