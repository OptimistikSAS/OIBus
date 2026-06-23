import { PassThrough } from 'node:stream';
import { mock } from 'node:test';
import { ReqResponse } from '../../service/http-request.utils';

/**
 * Helper to create a mock Undici response.
 * The body is a PassThrough stream (a Node.js Readable) so callers that stream
 * the response body (e.g. via pipeline()) work correctly, while the undici
 * BodyReadable helper methods (json/text/arrayBuffer/dump) are also available.
 */
export function createMockResponse(
  statusCode: number,
  body?: Record<string, unknown> | Array<unknown> | ArrayBuffer | string,
  headers: Record<string, string> = {}
): ReqResponse {
  let bodyBuffer: Buffer | undefined;
  if (body instanceof ArrayBuffer) {
    bodyBuffer = Buffer.from(body);
  } else if (typeof body === 'string') {
    bodyBuffer = Buffer.from(body);
  } else if (body !== undefined) {
    bodyBuffer = Buffer.from(JSON.stringify(body));
  }

  const bodyStream = new PassThrough() as PassThrough & {
    json: ReturnType<typeof mock.fn>;
    text: ReturnType<typeof mock.fn>;
    arrayBuffer: ReturnType<typeof mock.fn>;
    dump: ReturnType<typeof mock.fn>;
  };
  if (bodyBuffer !== undefined) {
    bodyStream.write(bodyBuffer);
  }
  bodyStream.end();

  bodyStream.json = mock.fn(async () => body);
  bodyStream.text = mock.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body)));
  bodyStream.arrayBuffer = mock.fn(async () => {
    if (bodyBuffer === undefined) return new ArrayBuffer(0);
    return bodyBuffer.buffer.slice(bodyBuffer.byteOffset, bodyBuffer.byteOffset + bodyBuffer.byteLength) as ArrayBuffer;
  });
  bodyStream.dump = mock.fn(async () => undefined);

  return {
    statusCode,
    headers,
    body: bodyStream,
    ok: statusCode >= 200 && statusCode <= 299
  } as unknown as ReqResponse;
}
