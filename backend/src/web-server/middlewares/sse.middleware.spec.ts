import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'stream';
import { sseMiddleware } from './sse.middleware';
import type SouthService from '../../service/south.service';
import type NorthService from '../../service/north.service';
import type OIBusService from '../../service/oibus.service';
import type HomeMetricsService from '../../service/metrics/home-metrics.service';
import type HistoryQueryService from '../../service/history-query.service';

const makeMockStream = () => new PassThrough();

const makeServices = (overrides: Record<string, unknown> = {}) => ({
  southService: { getSouthDataStream: mock.fn(() => makeMockStream()) } as unknown as SouthService,
  northService: { getNorthDataStream: mock.fn(() => makeMockStream()) } as unknown as NorthService,
  oIBusService: { stream: makeMockStream() } as unknown as OIBusService,
  homeMetricsService: { stream: makeMockStream() } as unknown as HomeMetricsService,
  historyQueryService: { getHistoryDataStream: mock.fn(() => makeMockStream()) } as unknown as HistoryQueryService,
  ...overrides
});

const makeReq = (path: string, extra: Record<string, unknown> = {}) => ({
  path,
  socket: { setKeepAlive: mock.fn() },
  ...extra
});

const makeRes = () => {
  const res = {
    set: mock.fn(),
    status: mock.fn(),
    end: mock.fn(),
    pipe: mock.fn()
  } as Record<string, ReturnType<typeof mock.fn>>;
  res.status = mock.fn(() => res);
  return res;
};

describe('sseMiddleware', () => {
  let services: ReturnType<typeof makeServices>;
  let mockNext: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    services = makeServices();
    mockNext = mock.fn();
  });

  it('should call next() for non-SSE paths', () => {
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/api/data');
    middleware(req as any, makeRes() as any, mockNext as any);

    assert.strictEqual(mockNext.mock.calls.length, 1);
  });

  it('should pipe south stream for /sse/south/:id', () => {
    const stream = makeMockStream();
    services.southService = { getSouthDataStream: mock.fn(() => stream) } as unknown as SouthService;
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/sse/south/south1');
    const res = makeRes();
    const pipeSpy = mock.method(stream, 'pipe', () => stream);

    middleware(req as any, res as any, mockNext as any);

    assert.strictEqual(res.set.mock.calls.length, 1);
    assert.strictEqual(pipeSpy.mock.calls.length, 1);
    assert.strictEqual((services.southService.getSouthDataStream as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], 'south1');
  });

  it('should pipe north stream for /sse/north/:id', () => {
    const stream = makeMockStream();
    services.northService = { getNorthDataStream: mock.fn(() => stream) } as unknown as NorthService;
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/sse/north/north1');
    const res = makeRes();
    const pipeSpy = mock.method(stream, 'pipe', () => stream);

    middleware(req as any, res as any, mockNext as any);

    assert.strictEqual(pipeSpy.mock.calls.length, 1);
    assert.strictEqual((services.northService.getNorthDataStream as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], 'north1');
  });

  it('should pipe engine stream for /sse/engine', () => {
    const stream = makeMockStream();
    services.oIBusService = { stream } as unknown as OIBusService;
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/sse/engine');
    const pipeSpy = mock.method(stream, 'pipe', () => stream);

    middleware(req as any, makeRes() as any, mockNext as any);

    assert.strictEqual(pipeSpy.mock.calls.length, 1);
  });

  it('should pipe home stream for /sse/home', () => {
    const stream = makeMockStream();
    services.homeMetricsService = { stream } as unknown as HomeMetricsService;
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/sse/home');
    const pipeSpy = mock.method(stream, 'pipe', () => stream);

    middleware(req as any, makeRes() as any, mockNext as any);

    assert.strictEqual(pipeSpy.mock.calls.length, 1);
  });

  it('should pipe history query stream for /sse/history-queries/:id', () => {
    const stream = makeMockStream();
    services.historyQueryService = { getHistoryDataStream: mock.fn(() => stream) } as unknown as HistoryQueryService;
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/sse/history-queries/hq1');
    const pipeSpy = mock.method(stream, 'pipe', () => stream);

    middleware(req as any, makeRes() as any, mockNext as any);

    assert.strictEqual(pipeSpy.mock.calls.length, 1);
    assert.strictEqual((services.historyQueryService.getHistoryDataStream as unknown as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], 'hq1');
  });

  it('should call next() for /sse path that matches no sub-route', () => {
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/sse/unknown-route');

    middleware(req as any, makeRes() as any, mockNext as any);

    assert.strictEqual(mockNext.mock.calls.length, 1);
  });

  it('should return 500 on SSE stream error', () => {
    services.southService = {
      getSouthDataStream: mock.fn(() => { throw new Error('stream error'); })
    } as unknown as SouthService;
    const middleware = sseMiddleware(
      services.southService, services.northService, services.oIBusService,
      services.homeMetricsService, services.historyQueryService
    );
    const req = makeReq('/sse/south/broken');
    const res = makeRes();

    middleware(req as any, res as any, mockNext as any);

    assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
    assert.strictEqual(res.end.mock.calls.length, 1);
  });
});
