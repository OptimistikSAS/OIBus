import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransformerService } from './transformer.service';
import { provideHttpClient } from '@angular/common/http';
import { TransformerDTO, TransformerCommandDTO } from '../../../../shared/model/transformer.model';

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

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('list', () => {
    it('should get all transformers', () => {
      const mockTransformers: Array<TransformerDTO> = [
        { id: '1', name: 'Transformer 1' } as TransformerDTO,
        { id: '2', name: 'Transformer 2' } as TransformerDTO
      ];

      service.list().subscribe(transformers => {
        expect(transformers).toEqual(mockTransformers);
      });

      const req = http.expectOne({ method: 'GET', url: '/api/transformers' });
      req.flush(mockTransformers);
    });

    it('should get transformers for a north connector', () => {
      const mockTransformers: Array<TransformerDTO> = [{ id: '1', name: 'North Transformer' } as TransformerDTO];
      const northId = 'north1';

      service.list({}, { northId }).subscribe(transformers => {
        expect(transformers).toEqual(mockTransformers);
      });

      const req = http.expectOne({ method: 'GET', url: `/api/north/${northId}/transformers` });
      req.flush(mockTransformers);
    });

    it('should get transformers for a south connector', () => {
      const mockTransformers: Array<TransformerDTO> = [{ id: '1', name: 'South Transformer' } as TransformerDTO];
      const southId = 'south1';

      service.list({}, { southId }).subscribe(transformers => {
        expect(transformers).toEqual(mockTransformers);
      });

      const req = http.expectOne({ method: 'GET', url: `/api/north/${southId}/transformers` });
      req.flush(mockTransformers);
    });

    it('should get transformers for a history query with north connector type', () => {
      const mockTransformers: Array<TransformerDTO> = [{ id: '1', name: 'History North Transformer' } as TransformerDTO];
      const historyId = 'history1';
      const connectorType = 'north';

      service.list({}, { historyId, connectorType }).subscribe(transformers => {
        expect(transformers).toEqual(mockTransformers);
      });

      const req = http.expectOne({ method: 'GET', url: `/api/history-queries/${historyId}/${connectorType}-transformers` });
      req.flush(mockTransformers);
    });

    it('should get transformers for a history query with south connector type', () => {
      const mockTransformers: Array<TransformerDTO> = [{ id: '1', name: 'History South Transformer' } as TransformerDTO];
      const historyId = 'history1';
      const connectorType = 'south';

      service.list({}, { historyId, connectorType }).subscribe(transformers => {
        expect(transformers).toEqual(mockTransformers);
      });

      const req = http.expectOne({ method: 'GET', url: `/api/history-queries/${historyId}/${connectorType}-transformers` });
      req.flush(mockTransformers);
    });
  });

  describe('get', () => {
    it('should get a single transformer', () => {
      const mockTransformer: TransformerDTO = { id: '1', name: 'Transformer 1' } as TransformerDTO;

      service.get('1').subscribe(transformer => {
        expect(transformer).toEqual(mockTransformer);
      });

      const req = http.expectOne({ method: 'GET', url: '/api/transformers/1' });
      req.flush(mockTransformer);
    });
  });

  describe('create', () => {
    it('should create a new transformer', () => {
      const newTransformer: TransformerCommandDTO = { name: 'New Transformer' } as TransformerDTO;
      const createdTransformer: TransformerDTO = { id: '1', name: 'New Transformer' } as TransformerDTO;

      service.create(newTransformer).subscribe(transformer => {
        expect(transformer).toEqual(createdTransformer);
      });

      const req = http.expectOne({ method: 'POST', url: '/api/transformers' });
      expect(req.request.body).toEqual(newTransformer);
      req.flush(createdTransformer);
    });

    it('should create a new transformer and assign to a north connector', () => {
      const newTransformer: TransformerCommandDTO = { name: 'New North Transformer' } as TransformerCommandDTO;
      const createdTransformer: TransformerDTO = { id: '1', name: 'New North Transformer' } as TransformerDTO;
      const northId = 'north1';

      service.create(newTransformer, { northId }).subscribe(transformer => {
        expect(transformer).toEqual(createdTransformer);
      });

      const req = http.expectOne(req => req.url === '/api/transformers' && req.params.get('northId') === northId && req.method === 'POST');
      expect(req.request.body).toEqual(newTransformer);
      req.flush(createdTransformer);
    });

    it('should create a new transformer and assign to a south connector', () => {
      const newTransformer: TransformerCommandDTO = { name: 'New South Transformer' } as TransformerCommandDTO;
      const createdTransformer: TransformerDTO = { id: '1', name: 'New South Transformer' } as TransformerDTO;
      const southId = 'south1';

      service.create(newTransformer, { southId }).subscribe(transformer => {
        expect(transformer).toEqual(createdTransformer);
      });

      const req = http.expectOne(req => req.url === '/api/transformers' && req.params.get('southId') === southId && req.method === 'POST');
      expect(req.request.body).toEqual(newTransformer);
      req.flush(createdTransformer);
    });

    it('should create a new transformer and assign to a history query', () => {
      const newTransformer: TransformerCommandDTO = { name: 'New History Transformer' } as TransformerCommandDTO;
      const createdTransformer: TransformerDTO = { id: '1', name: 'New History Transformer' } as TransformerDTO;
      const historyId = 'history1';
      const connectorType = 'north';

      service.create(newTransformer, { historyId, connectorType }).subscribe(transformer => {
        expect(transformer).toEqual(createdTransformer);
      });

      const req = http.expectOne(
        req =>
          req.url === '/api/transformers' &&
          req.params.get('historyId') === historyId &&
          req.params.get('connectorType') === connectorType &&
          req.method === 'POST'
      );
      expect(req.request.body).toEqual(newTransformer);
      req.flush(createdTransformer);
    });
  });

  describe('update', () => {
    it('should update an existing transformer', () => {
      const updatedTransformer: TransformerCommandDTO = { name: 'Updated Transformer' } as TransformerDTO;

      service.update('1', updatedTransformer).subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({ method: 'PUT', url: '/api/transformers/1' });
      expect(req.request.body).toEqual(updatedTransformer);
      req.flush(null);
    });
  });

  describe('delete', () => {
    it('should delete a transformer', () => {
      service.delete('1').subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({ method: 'DELETE', url: '/api/transformers/1' });
      req.flush(null);
    });
  });

  describe('assign', () => {
    it('should assign a transformer to a north connector', () => {
      const northId = 'north1';
      const transformerId = '1';

      service.assign(transformerId, { northId }).subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({ method: 'POST', url: `/api/north/${northId}/transformers/${transformerId}` });
      req.flush(null);
    });

    it('should assign a transformer to a south connector', () => {
      const southId = 'south1';
      const transformerId = '1';

      service.assign(transformerId, { southId }).subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({ method: 'POST', url: `/api/north/${southId}/transformers/${transformerId}` });
      req.flush(null);
    });

    it('should assign a transformer to a history query', () => {
      const historyId = 'history1';
      const connectorType = 'south';
      const transformerId = '1';

      service.assign(transformerId, { historyId, connectorType }).subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({
        method: 'POST',
        url: `/api/history-queries/${historyId}/${connectorType}-transformers/${transformerId}`
      });
      req.flush(null);
    });
  });

  describe('unassign', () => {
    it('should unassign a transformer from a south connector', () => {
      const southId = 'south1';
      const transformerId = '1';

      service.unassign(transformerId, { southId }).subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({ method: 'DELETE', url: `/api/north/${southId}/transformers/${transformerId}` });
      req.flush(null);
    });

    it('should unassign a transformer from a north connector', () => {
      const northId = 'north1';
      const transformerId = '1';

      service.unassign(transformerId, { northId }).subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({ method: 'DELETE', url: `/api/north/${northId}/transformers/${transformerId}` });
      req.flush(null);
    });

    it('should unassign a transformer from a history query', () => {
      const historyId = 'history1';
      const connectorType = 'north';
      const transformerId = '1';

      service.unassign(transformerId, { historyId, connectorType }).subscribe(response => {
        expect(response).toBeNull();
      });

      const req = http.expectOne({
        method: 'DELETE',
        url: `/api/history-queries/${historyId}/${connectorType}-transformers/${transformerId}`
      });
      req.flush(null);
    });
  });
});
