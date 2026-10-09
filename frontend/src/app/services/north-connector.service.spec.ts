import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { NorthType } from '@oibus/shared/connector/north-manifest.model';
import {
  CacheContentUpdateCommand,
  CacheSearchResult,
  FileCacheContent,
  OIBusConnectionTestResult
} from '@oibus/shared/domain/engine.model';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { SHOULD_IGNORE_ERROR_PREDICATE } from '../shared/error-interceptor.service';
import { NorthConnectorService } from './north-connector.service';

interface HttpCase {
  name: string;
  call: (service: NorthConnectorService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

/** Background requests and inline-displayed errors must not be notified globally, except an expired session */
function expectErrorsIgnoredUnlessUnauthorized(request: TestRequest) {
  const shouldIgnore = request.request.context.get(SHOULD_IGNORE_ERROR_PREDICATE);
  expect(shouldIgnore(new HttpErrorResponse({ status: 500 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 400 }))).toBe(true);
  expect(shouldIgnore(new HttpErrorResponse({ status: 401 }))).toBe(false);
}

const northTypes: Array<NorthType> = [
  { id: 'console', category: 'debug', types: ['any'] },
  { id: 'mqtt', category: 'iot', types: ['time-values'] }
];
const cacheSearchResult: CacheSearchResult = {
  searchDate: testData.constants.dates.DATE_1,
  metrics: {
    lastConnection: null,
    lastRunStart: null,
    lastRunDuration: null,
    currentCacheSize: 10,
    currentErrorSize: 0,
    currentArchiveSize: 0
  },
  cache: [
    {
      filename: 'file1',
      metadata: {
        contentFile: 'file1.json',
        contentSize: 10,
        numberOfElement: 1,
        createdAt: testData.constants.dates.DATE_1,
        contentType: 'time-values'
      }
    }
  ],
  error: [],
  archive: []
};
const fileCacheContent: FileCacheContent = {
  content: '{}',
  contentFilename: 'file1.json',
  contentType: 'json',
  truncated: false,
  totalSize: 2
};
const updateCommand: CacheContentUpdateCommand = {
  cache: { remove: ['file1'], move: [{ filename: 'file2', to: 'archive' }] },
  error: { remove: [], move: [] },
  archive: { remove: [], move: [] }
};
const connectionTestResult: OIBusConnectionTestResult = { items: [{ key: 'Connected', value: 'true' }] };

describe('NorthConnectorService', () => {
  let http: HttpTestingController;
  let service: NorthConnectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NorthConnectorService);
  });

  afterEach(() => http.verify());

  const command = testData.north.command;
  const north = testData.north.list[0];
  const transformer = north.transformers[0];

  test.each<HttpCase>([
    { name: 'get the North types', call: s => s.getNorthTypes(), method: 'GET', url: '/api/north/types', body: null, response: northTypes },
    {
      name: 'get a North manifest',
      call: s => s.getNorthManifest('console'),
      method: 'GET',
      url: '/api/north/manifests/console',
      body: null,
      response: testData.north.manifest
    },
    {
      name: 'list the North connectors',
      call: s => s.list(),
      method: 'GET',
      url: '/api/north',
      body: null,
      response: testData.north.listLight
    },
    { name: 'get a North connector', call: s => s.findById('id1'), method: 'GET', url: '/api/north/id1', body: null, response: north },
    {
      name: 'create a North connector',
      call: s => s.create(command, ''),
      method: 'POST',
      url: '/api/north',
      body: command,
      response: north
    },
    {
      name: 'create a North connector duplicated from another one',
      call: s => s.create(command, 'northId2'),
      method: 'POST',
      url: '/api/north?duplicate=northId2',
      body: command,
      response: north
    },
    {
      name: 'update a North connector',
      call: s => s.update('id1', command),
      method: 'PUT',
      url: '/api/north/id1',
      body: command,
      response: null
    },
    { name: 'delete a North connector', call: s => s.delete('id1'), method: 'DELETE', url: '/api/north/id1', body: null, response: null },
    { name: 'start a North connector', call: s => s.start('id1'), method: 'POST', url: '/api/north/id1/start', body: null, response: null },
    { name: 'stop a North connector', call: s => s.stop('id1'), method: 'POST', url: '/api/north/id1/stop', body: null, response: null },
    {
      name: 'reset the North metrics',
      call: s => s.resetMetrics('id1'),
      method: 'POST',
      url: '/api/north/id1/metrics/reset',
      body: null,
      response: null
    },
    {
      name: 'add or edit a North transformer',
      call: s => s.addOrEditTransformer('id1', transformer),
      method: 'POST',
      url: '/api/north/id1/transformers',
      body: transformer,
      response: transformer
    },
    {
      name: 'remove a North transformer',
      call: s => s.removeTransformer('id1', 'transformerId'),
      method: 'DELETE',
      url: '/api/north/id1/transformers/transformerId',
      body: null,
      response: null
    },
    {
      name: 'search the cache content with every filter',
      call: s =>
        s.searchCacheContent('id1', {
          start: '2020-01-01T00:00:00.000Z',
          end: '2021-01-01T00:00:00.000Z',
          nameContains: 'file',
          maxNumberOfFilesReturned: 1000
        }),
      method: 'GET',
      url: '/api/north/id1/cache/search?maxNumberOfFilesReturned=1000&start=2020-01-01T00:00:00.000Z&end=2021-01-01T00:00:00.000Z&nameContains=file',
      body: null,
      response: cacheSearchResult
    },
    {
      name: 'search the cache content without optional filters',
      call: s => s.searchCacheContent('id1', { start: undefined, end: undefined, nameContains: undefined, maxNumberOfFilesReturned: 0 }),
      method: 'GET',
      url: '/api/north/id1/cache/search?maxNumberOfFilesReturned=0',
      body: null,
      response: cacheSearchResult
    },
    {
      name: 'get a cache file content',
      call: s => s.getCacheFileContent('id1', 'cache', 'file1'),
      method: 'GET',
      url: '/api/north/id1/cache/content/file1?folder=cache',
      body: null,
      response: fileCacheContent
    },
    {
      name: 'update the cache content',
      call: s => s.updateCacheContent('id1', updateCommand),
      method: 'POST',
      url: '/api/north/id1/cache/update',
      body: updateCommand,
      response: null
    }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test('should get the North metrics and only notify an expired session', async () => {
    const result = firstValueFrom(service.getMetrics('id1'));

    const request = http.expectOne({ method: 'GET', url: '/api/north/id1/metrics' });
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(testData.north.metrics);

    await expect(result).resolves.toEqual(testData.north.metrics);
  });

  test('should test a North connection and leave the error display to the caller', async () => {
    const result = firstValueFrom(service.testConnection('id1', command.settings, command.type));

    const request = http.expectOne({ method: 'POST', url: '/api/north/id1/test/connection?northType=file-writer' });
    expect(request.request.body).toEqual(command.settings);
    expectErrorsIgnoredUnlessUnauthorized(request);
    request.flush(connectionTestResult);

    await expect(result).resolves.toEqual(connectionTestResult);
  });
});
