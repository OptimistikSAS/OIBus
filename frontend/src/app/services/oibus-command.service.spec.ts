import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OibusCommandService } from './oibus-command.service';
import { OIBusCommandDTO } from '../../../../shared/model/command.model';
import { Page } from '../../../../shared/model/types';
import { toPage } from '../shared/test-utils';
import { provideHttpClient } from '@angular/common/http';

describe('OibusCommandService', () => {
  let http: HttpTestingController;
  let service: OibusCommandService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(OibusCommandService);
  });

  afterEach(() => http.verify());

  it('should search Commands', () => {
    let expectedCommands: Page<OIBusCommandDTO> | null = null;
    const commands = toPage<OIBusCommandDTO>([{ id: '1' }] as Array<OIBusCommandDTO>);

    service.searchCommands({ page: 0, types: ['UPGRADE'], status: ['COMPLETED', 'CANCELLED'] }).subscribe(c => (expectedCommands = c));

    http
      .expectOne({
        method: 'GET',
        url: '/api/commands?page=0&types=UPGRADE&status=COMPLETED&status=CANCELLED'
      })
      .flush(commands);

    expect(expectedCommands!).toEqual(commands);
  });
});
