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
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
      arrayBuffer: jest.fn().mockReturnValue(body)
    },
    ok: statusCode >= 200 && statusCode <= 299
  } as unknown as ReqResponse;
}
