import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OibusCommandService } from './oibus-command.service';
import { OIBusCommandDTO } from '../../../../backend/shared/model/command.model';
import { Page } from '../../../../backend/shared/model/types';
import { toPage } from '../shared/test-utils';

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

  it('should search Commands', () => {
    let expectedCommands: Page<OIBusCommandDTO> | null = null;
    const commands = toPage<OIBusCommandDTO>([{ id: '1' }] as Array<OIBusCommandDTO>);

    service
      .search({
        page: 0,
        types: ['update-version'],
        status: ['COMPLETED', 'CANCELLED'],
        ack: undefined,
        start: undefined,
        end: undefined
      })
      .subscribe(c => (expectedCommands = c));

    http
      .expectOne({
        method: 'GET',
        url: '/api/oianalytics/commands/search?page=0&types=update-version&status=COMPLETED&status=CANCELLED'
      })
      .flush(commands);

    expect(expectedCommands!).toEqual(commands);
  });

  it('should delete a command', () => {
    let done = false;
    service.delete({ id: 'id1' } as OIBusCommandDTO).subscribe(() => (done = true));
    const testRequest = http.expectOne({ method: 'DELETE', url: '/api/oianalytics/commands/id1' });
    testRequest.flush(null);
    expect(done).toBe(true);
  });
});
