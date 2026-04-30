import { mock } from 'node:test';
import { ReqResponse } from '../../service/http-request.utils';

/**
 * Helper to create a mock Undici response
 */
export function createMockResponse(
  statusCode: number,
  body?: Record<string, unknown> | Array<unknown> | ArrayBuffer | string,
  headers: Record<string, string> = {}
): ReqResponse {
  return {
    statusCode,
    headers,
    body: {
      json: mock.fn(async () => body),
      text: mock.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body))),
      arrayBuffer: mock.fn(() => body)
    },
    ok: statusCode >= 200 && statusCode <= 299
  } as unknown as ReqResponse;
}
