import { createReadStream } from 'node:fs';
import path from 'node:path';

import FormData from 'form-data';
import fetch from 'node-fetch';

export interface FetchError extends Error {
  responseError?: boolean;
  statusCode?: number;
}

/**
 * Mutate the headers to add authentication headers according to the type of authentication
 * @return {void}
 */
const addAuthenticationToHeaders = (
  headers: any,
  type: 'Basic' | 'API Key' | 'Bearer' | string,
  key: string | null,
  secret: string | null
) => {
  switch (type) {
    case 'Basic':
      headers.Authorization = `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
      break;

    case 'API Key':
      if (!key) {
        throw new Error(`Authentication type API key needs a key.`);
      }
      headers[key] = secret;
      break;

    case 'Bearer':
      headers.Authorization = `Bearer ${secret}`;
      break;

    default:
      throw new Error(`Unrecognized authentication type: "${type}".`);
  }
};

/**
 * Send the request using node-fetch
 * If "headers" contains Content-Type "data" is sent as string in the body.
 * If "headers" doesn't contain Content-Type "data" is interpreted as a path and sent as a file.
 */
const httpSend = async (requestUrl: string, method: string, headers: any, data: string, timeout: number, proxyAgent: any) => {
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
