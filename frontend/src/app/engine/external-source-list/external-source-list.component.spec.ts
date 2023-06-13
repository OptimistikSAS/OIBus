import { TestBed } from '@angular/core/testing';

import { ExternalSourceListComponent } from './external-source-list.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { of } from 'rxjs';
import { ExternalSourceService } from '../../services/external-source.service';
import { ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

class ExternalSourceListComponentTester extends ComponentTester<ExternalSourceListComponent> {
  constructor() {
    super(ExternalSourceListComponent);
  }

  get title() {
    return this.element('#title')!;
  }

  get deleteButtons() {
    return this.elements('.delete-external-source') as Array<TestButton>;
  }

  get editButtons() {
    return this.elements('.edit-external-source') as Array<TestButton>;
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
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  let externalSources: Array<ExternalSourceDTO>;

  beforeEach(() => {
    externalSourceService = createMock(ExternalSourceService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: ExternalSourceService, useValue: externalSourceService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    externalSources = [
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

    tester = new ExternalSourceListComponentTester();
  });

  describe('with external source', () => {
    beforeEach(() => {
      externalSourceService.list.and.returnValue(of(externalSources));
      tester.detectChanges();
    });

    it('should display a list of external sources', () => {
      expect(tester.title).toContainText('External sources');
      expect(tester.externalSources.length).toEqual(2);
      expect(tester.externalSources[0].elements('td').length).toEqual(3);
      expect(tester.externalSources[1].elements('td')[0]).toContainText('ref2');
      expect(tester.externalSources[1].elements('td')[1]).toContainText('My external source 2');
    });
  });

  describe('with no external source', () => {
    it('should display an empty list', () => {
      externalSourceService.list.and.returnValue(of([]));
      tester.detectChanges();
      expect(tester.noExternalSource).toContainText('No external source');
    });
  });
});
