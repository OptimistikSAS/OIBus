import { TestBed } from '@angular/core/testing';

import { ExternalSourceListComponent } from './external-source-list.component';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ExternalSourceService } from '../../services/external-source.service';
import { ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';

class ExternalSourceListComponentTester extends ComponentTester<ExternalSourceListComponent> {
  constructor() {
    super(ExternalSourceListComponent);
  }

  get title() {
    return this.element('h2')!;
  }

  get addExternalSource() {
    return this.button('#add-external-source')!;
  }

  get noExternalSource() {
    return this.element('#no-external-source');
  }
  get externalSources() {
    return this.elements('tbody tr');
  }
}

describe('ExternalSourceListComponent', () => {
  let tester: ExternalSourceListComponentTester;
  let externalSourceService: jasmine.SpyObj<ExternalSourceService>;

  beforeEach(() => {
    externalSourceService = createMock(ExternalSourceService);

    TestBed.configureTestingModule({
      imports: [ExternalSourceListComponent],
      providers: [provideTestingI18n(), { provide: ExternalSourceService, useValue: externalSourceService }]
    });

    tester = new ExternalSourceListComponentTester();
  });

  it('should display a list of external sources', () => {
    const externalSources: Array<ExternalSourceDTO> = [
      {
        id: 'id1',
        reference: 'ref1',
        description: 'My external source 1'
      },
      {
        id: 'id2',
        reference: 'ref2',
        description: 'My external source 2'
      }
    ];

    externalSourceService.getExternalSources.and.returnValue(of(externalSources));
    tester.detectChanges();

    expect(tester.title).toContainText('External source list');
    expect(tester.externalSources.length).toEqual(2);
    expect(tester.externalSources[0].elements('td').length).toEqual(3);
    expect(tester.externalSources[1].elements('td')[0]).toContainText('ref2');
    expect(tester.externalSources[1].elements('td')[1]).toContainText('My external source 2');
  });

  it('should display an empty list', () => {
    externalSourceService.getExternalSources.and.returnValue(of([]));
    tester.detectChanges();

    expect(tester.title).toContainText('External source list');
    expect(tester.noExternalSource).toContainText('No external source');
  });
});
