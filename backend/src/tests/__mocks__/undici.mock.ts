import { ReqResponse } from '../../service/http-request.utils';

/**
 * Helper to create a mock Undici response
 */
export function createMockResponse(
  statusCode: number,
  body?: Record<string, unknown> | string,
  headers: Record<string, string> = {}
): ReqResponse {
  return {
    statusCode,
    headers,
    body: {
      json: jest.fn().mockResolvedValue(body),
      text: jest.fn().mockResolvedValue(JSON.stringify(body))
    },
    ok: statusCode >= 200 && statusCode <= 299
  } as unknown as ReqResponse;
}
