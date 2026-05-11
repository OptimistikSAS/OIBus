import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInjectServicesMiddleware } from './services.middleware';
import { createMockServices } from '../../tests/utils/test-utils';
import type { CustomExpressRequest } from '../express';

describe('createInjectServicesMiddleware', () => {
  it('should inject all 12 services into req.services and call next()', () => {
    const services = createMockServices();
    const middleware = createInjectServicesMiddleware(
      services.certificateService,
      services.historyQueryService,
      services.ipFilterService,
      services.logService,
      services.northService,
      services.oIAnalyticsCommandService,
      services.oIAnalyticsRegistrationService,
      services.oIBusService,
      services.scanModeService,
      services.southService,
      services.transformerService,
      services.userService
    );

    const req = {} as CustomExpressRequest;
    let nextCalled = false;
    middleware(req, {} as any, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.services.certificateService, services.certificateService);
    assert.strictEqual(req.services.historyQueryService, services.historyQueryService);
    assert.strictEqual(req.services.ipFilterService, services.ipFilterService);
    assert.strictEqual(req.services.logService, services.logService);
    assert.strictEqual(req.services.northService, services.northService);
    assert.strictEqual(req.services.oIAnalyticsCommandService, services.oIAnalyticsCommandService);
    assert.strictEqual(req.services.oIAnalyticsRegistrationService, services.oIAnalyticsRegistrationService);
    assert.strictEqual(req.services.oIBusService, services.oIBusService);
    assert.strictEqual(req.services.scanModeService, services.scanModeService);
    assert.strictEqual(req.services.southService, services.southService);
    assert.strictEqual(req.services.transformerService, services.transformerService);
    assert.strictEqual(req.services.userService, services.userService);
  });
});
