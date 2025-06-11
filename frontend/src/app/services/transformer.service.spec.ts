import { TestBed } from '@angular/core/testing';

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TransformerService } from './transformer.service';
import { CustomTransformerCommand, TransformerDTO } from '../../../../backend/shared/model/transformer.model';

describe('TransformerService', () => {
  let http: HttpTestingController;
  let service: TransformerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TransformerService);
  });

  afterEach(() => http.verify());

  it('should get all transformers', () => {
    let expectedTransformers: Array<TransformerDTO> = [];
    service.list().subscribe(transformers => (expectedTransformers = transformers));

    http.expectOne('/api/transformers').flush([{ name: 'Transformer 1' }, { name: 'Transformer 2' }]);

    expect(expectedTransformers.length).toBe(2);
  });

  it('should get a transformer', () => {
    let expectedTransformer: TransformerDTO | null = null;
    const transformer = { id: 'id1' } as TransformerDTO;

    service.get('id1').subscribe(c => (expectedTransformer = c));

    http.expectOne({ url: '/api/transformers/id1', method: 'GET' }).flush(transformer);
    expect(expectedTransformer!).toEqual(transformer);
  });

  it('should create a transformer', () => {
    let done = false;
    const command: CustomTransformerCommand = {
      name: 'myTransformer',
      description: 'a transformer'
    } as CustomTransformerCommand;

    service.create(command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'POST', url: '/api/transformers' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should update a transformer', () => {
    let done = false;
    const command: CustomTransformerCommand = {
      name: 'myTransformer',
      description: 'a transformer'
    } as CustomTransformerCommand;

    service.update('id1', command).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'PUT', url: '/api/transformers/id1' });
    expect(testRequest.request.body).toEqual(command);
    testRequest.flush(null);
    expect(done).toBe(true);
  });

  it('should delete a transformer', () => {
    let done = false;
    service.delete('id1').subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/transformers/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
