import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { toPage } from '../shared/utils/page.utils';
import { OibusCommandService } from './oibus-command.service';

describe('OibusCommandService', () => {
  let http: HttpTestingController;
  let service: OibusCommandService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(OibusCommandService);
  });

  afterEach(() => http.verify());

  const commands = toPage(testData.oIAnalytics.commands.oIBusList);

  test('should search commands by type and status', async () => {
    const result = await expectHttp(
      http,
      service.search({
        page: 1,
        types: ['update-version'],
        status: ['COMPLETED', 'CANCELLED'],
        ack: undefined,
        start: undefined,
        end: undefined
      }),
      { method: 'GET', url: '/api/oianalytics/commands/search?page=1&types=update-version&status=COMPLETED&status=CANCELLED' },
      { response: commands }
    );

    expect(result).toEqual(commands);
  });

  test('should search commands without filter', async () => {
    const result = await expectHttp(
      http,
      service.search({ page: 0, types: [], status: [], ack: undefined, start: undefined, end: undefined }),
      { method: 'GET', url: '/api/oianalytics/commands/search?page=0' },
      { response: commands }
    );

    expect(result).toEqual(commands);
  });

  test('should delete a command', async () => {
    const command = testData.oIAnalytics.commands.oIBusList[0];

    const result = await expectHttp(http, service.delete(command), { method: 'DELETE', url: `/api/oianalytics/commands/${command.id}` });

    expect(result).toBeNull();
  });
});
