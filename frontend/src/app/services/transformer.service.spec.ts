import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { SouthConnectorItemTestResult } from '@oibus/shared/api/south-connector.model';
import { InputTemplate, TransformerTestRequest, TransformerTestResponse } from '@oibus/shared/api/transformer.model';

import { expectHttp } from '../../test/http-testing';
import testData from '../../test/test-data';
import { TransformerService } from './transformer.service';

interface HttpCase {
  name: string;
  call: (service: TransformerService) => Observable<unknown>;
  method: string;
  url: string;
  body: unknown;
  response: unknown;
}

describe('TransformerService', () => {
  let http: HttpTestingController;
  let service: TransformerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TransformerService);
  });

  afterEach(() => http.verify());

  const command = testData.transformers.command;
  const transformer = testData.transformers.customList[0];
  const testRequest: TransformerTestRequest = { inputData: '{}', options: { precision: 2 } };
  const testResponse: TransformerTestResponse = {
    output: '{"value":42}',
    metadata: { contentType: 'any', contentFile: '', contentSize: 12, createdAt: testData.constants.dates.DATE_1, numberOfElement: 1 }
  };
  const itemTestResult: SouthConnectorItemTestResult = {
    raw: { type: 'any-content', content: 'raw' },
    transformed: { type: 'any-content', content: 'transformed' },
    connectionDuration: 1,
    queryDuration: 2
  };
  const inputTemplate: InputTemplate = { type: 'time-values', data: '[]', description: 'Sample' };

  test.each<HttpCase>([
    {
      name: 'list the transformers',
      call: s => s.list(),
      method: 'GET',
      url: '/api/transformers/list',
      body: null,
      response: testData.transformers.customList
    },
    {
      name: 'get a transformer',
      call: s => s.findById('id1'),
      method: 'GET',
      url: '/api/transformers/id1',
      body: null,
      response: transformer
    },
    {
      name: 'create a transformer',
      call: s => s.create(command),
      method: 'POST',
      url: '/api/transformers',
      body: command,
      response: transformer
    },
    {
      name: 'update a transformer',
      call: s => s.update('id1', command),
      method: 'PUT',
      url: '/api/transformers/id1',
      body: command,
      response: null
    },
    {
      name: 'delete a transformer',
      call: s => s.delete('id1'),
      method: 'DELETE',
      url: '/api/transformers/id1',
      body: null,
      response: null
    },
    {
      name: 'test a custom transformer',
      call: s => s.test(command, testRequest),
      method: 'POST',
      url: '/api/transformers/test',
      body: { transformer: command, testRequest },
      response: testResponse
    },
    {
      name: 'test a configured transformer',
      call: s => s.testTransformer('id1', testRequest),
      method: 'POST',
      url: '/api/transformers/id1/test',
      body: testRequest,
      response: itemTestResult
    },
    {
      name: 'get an input template',
      call: s => s.getInputTemplate('time-values'),
      method: 'GET',
      url: '/api/transformers/template/time-values',
      body: null,
      response: inputTemplate
    }
  ])('should $name', async ({ call, method, url, body, response }) => {
    const result = await expectHttp(http, call(service), { method, url }, { body, response });

    expect(result).toEqual(response);
  });

  test('should share the transformer list between subscribers', async () => {
    const list = await expectHttp(
      http,
      service.list(),
      { method: 'GET', url: '/api/transformers/list' },
      { response: testData.transformers.customList }
    );

    // no new request: http.verify() fails if one is made
    await expect(firstValueFrom(service.list())).resolves.toEqual(list);
  });

  test.each<Omit<HttpCase, 'body' | 'response'>>([
    { name: 'create', call: s => s.create(command), method: 'POST', url: '/api/transformers' },
    { name: 'update', call: s => s.update('id1', command), method: 'PUT', url: '/api/transformers/id1' },
    { name: 'delete', call: s => s.delete('id1'), method: 'DELETE', url: '/api/transformers/id1' }
  ])('should reload the transformer list after a $name', async ({ call, method, url }) => {
    await expectHttp(
      http,
      service.list(),
      { method: 'GET', url: '/api/transformers/list' },
      { response: testData.transformers.customList }
    );

    await expectHttp(http, call(service), { method, url });

    const reloadedList = [transformer];
    http.expectOne({ method: 'GET', url: '/api/transformers/list' }).flush(reloadedList);
    await expect(firstValueFrom(service.list())).resolves.toEqual(reloadedList);
  });
});
