import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { TransformerService } from './transformer.service';
import { TransformerDTO } from '../../../../backend/shared/model/transformer.model';
import testData from '../../../../backend/src/tests/utils/test-data';

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

  test('should get all transformers', () => {
    let expectedTransformers: Array<TransformerDTO> = [];
    service.list().subscribe(transformers => (expectedTransformers = transformers));

    http.expectOne('/api/transformers/list').flush([{ name: 'Transformer 1' }, { name: 'Transformer 2' }]);

    expect(expectedTransformers.length).toBe(2);
  });

  test('should get a transformer', () => {
    let expectedTransformer: TransformerDTO | null = null;
    const transformer = { id: 'id1' } as TransformerDTO;

    service.findById('id1').subscribe(c => (expectedTransformer = c));

    http.expectOne({ url: '/api/transformers/id1', method: 'GET' }).flush(transformer);
    expect(expectedTransformer!).toEqual(transformer);
  });

  test('should create a transformer', () => {
    let done = false;
    const command = testData.transformers.command;

    service.create(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/transformers' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should update a transformer', () => {
    let done = false;
    const command = testData.transformers.command;

    service.update('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/transformers/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should delete a transformer', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/transformers/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  test('should test a transformer', () => {
    let done = false;
    const command = testData.transformers.command;
    const testRequest = { inputData: '{}', options: {} };

    service.test(command, testRequest).subscribe(() => (done = true));
    const testReq = http.expectOne({ method: 'POST', url: '/api/transformers/test' });
    expect(testReq.request.body).toEqual({ transformer: command, testRequest });
    testReq.flush(null);
    expect(done).toBe(true);
  });

  test('should get input template', () => {
    let result: { type: string; data: string; description: string } | null = null;
    const expected = { type: 'time-values', data: '[]', description: 'Sample' };
    service.getInputTemplate('time-values').subscribe(t => (result = t));
    http.expectOne({ url: '/api/transformers/template/time-values', method: 'GET' }).flush(expected);
    expect(result).toEqual(expected);
  });
});
