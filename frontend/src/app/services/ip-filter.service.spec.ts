import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { IpFilterService } from './ip-filter.service';

interface HttpCase {
  name: string;
  call: (service: IpFilterService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

describe('IpFilterService', () => {
  let http: HttpTestingController;
  let service: IpFilterService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(IpFilterService);
  });

  afterEach(() => http.verify());

  const command = testData.ipFilters.command;
  const ipFilter = testData.ipFilters.list[0];

  test.each<HttpCase>([
    {
      name: 'list the IP filters',
      call: s => s.list(),
      method: 'GET',
      url: '/api/ip-filters',
      body: null,
      response: testData.ipFilters.list
    },
    { name: 'get an IP filter', call: s => s.findById('id1'), method: 'GET', url: '/api/ip-filters/id1', body: null, response: ipFilter },
    {
      name: 'create an IP filter',
      call: s => s.create(command),
      method: 'POST',
      url: '/api/ip-filters',
      body: command,
      response: ipFilter
    },
    {
      name: 'update an IP filter',
      call: s => s.update('id1', command),
      method: 'PUT',
      url: '/api/ip-filters/id1',
      body: command,
      response: null
    },
    { name: 'delete an IP filter', call: s => s.delete('id1'), method: 'DELETE', url: '/api/ip-filters/id1', body: null, response: null }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });
});
