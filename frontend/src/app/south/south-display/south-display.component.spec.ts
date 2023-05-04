import { TestBed } from '@angular/core/testing';

import { SouthDisplayComponent } from './south-display.component';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { SouthConnectorService } from '../../services/south-connector.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { of, Subject } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideTestingI18n } from '../../../i18n/mock-i18n';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { toPage } from '../../shared/test-utils';
import { ConfirmationService } from '../../shared/confirmation.service';
import { NotificationService } from '../../shared/notification.service';

class SouthDisplayComponentTester extends ComponentTester<SouthDisplayComponent> {
  constructor() {
    super(SouthDisplayComponent);
  }

  get title() {
    return this.element('#title');
  }

  get description() {
    return this.element('#description');
  }

  get importButton() {
    return this.button('#import-button')!;
  }

  get fileInput() {
    return this.input('#file')!;
  }

  get importSpinner() {
    return this.element('#import-button .spinner-border')!;
  }

  get exportButton() {
    return this.button('#export-items')!;
  }

  get exportSpinner() {
    return this.element('#export-items .spinner-border')!;
  }

  get deleteAllButtons() {
    return this.button('#delete-all-items')!;
  }
}

describe('SouthDisplayComponent', () => {
  let tester: SouthDisplayComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let confirmationService: jasmine.SpyObj<ConfirmationService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const southConnector: SouthConnectorDTO = {
    id: 'id1',
    type: 'Generic',
    name: 'South Connector',
    description: 'My South connector description',
    enabled: true,
    history: {
      maxInstantPerItem: false,
      maxReadInterval: 0,
      readDelay: 200
    },
    settings: {}
  };

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      imports: [SouthDisplayComponent],
      providers: [
        provideTestingI18n(),
        provideRouter([]),
        provideHttpClient(),
        {
          provide: ActivatedRoute,
          useValue: stubRoute({
            params: {
              southId: 'id1'
            }
          })
        },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    southConnectorService.getSouthConnector.and.returnValue(of(southConnector));
    southConnectorService.searchSouthItems.and.returnValue(
      of(
        toPage<OibusItemDTO>([
          {
            id: 'id1',
            name: 'item1',
            connectorId: 'southId',
            settings: {},
            scanModeId: 'scanModeId1'
          }
        ])
      )
    );

    tester = new SouthDisplayComponentTester();
    tester.detectChanges();
  });

  it('should display South connector description', () => {
    expect(tester.title).toContainText(southConnector.name);
    expect(tester.description).toContainText(southConnector.description);
  });

  it('should select a file', () => {
    spyOn(tester.fileInput.nativeElement, 'click');
    tester.importButton.click();
    expect(tester.fileInput.nativeElement.click).toHaveBeenCalled();
  });

  it('should trigger the upload', () => {
    const importationSubject = new Subject<void>();
    southConnectorService.uploadItems.and.returnValue(importationSubject);

    const event = new Event('change');
    tester.fileInput.dispatchEvent(event);
    importationSubject.next();
    importationSubject.complete();
    tester.detectChanges();
    expect(southConnectorService.uploadItems).toHaveBeenCalled();
  });

  it('should import', () => {
    const fakeFile = { name: 'test.xlsx' } as File;
    const importationSubject = new Subject<void>();
    southConnectorService.uploadItems.and.returnValue(importationSubject);

    expect(tester.importSpinner).toBeNull();
    tester.componentInstance.importItems(fakeFile);
    tester.detectChanges();

    expect(tester.importSpinner).not.toBeNull();
    expect(tester.importButton.disabled).toBe(true);
    expect(southConnectorService.uploadItems).toHaveBeenCalledWith('id1', fakeFile);

    importationSubject.next();
    importationSubject.complete();
    tester.detectChanges();

    expect(tester.importSpinner).toBeNull();
  });

  it('should export the items', () => {
    const exportSubject = new Subject<void>();
    southConnectorService.exportItems.and.returnValue(exportSubject);

    expect(tester.exportButton).toBeDefined();
    expect(tester.exportSpinner).toBeNull();
    tester.exportButton.click();
    tester.detectChanges();

    expect(tester.exportSpinner).not.toBeNull();

    exportSubject.next();
    exportSubject.complete();
    tester.detectChanges();

    expect(southConnectorService.exportItems).toHaveBeenCalledWith('id1', 'South Connector');
    expect(tester.exportSpinner).toBeNull();
  });

  it('should delete all items', () => {
    confirmationService.confirm.and.returnValue(of(undefined));
    southConnectorService.deleteAllSouthItems.and.returnValue(of(undefined));

    tester.deleteAllButtons.click();
    tester.detectChanges();

    expect(confirmationService.confirm).toHaveBeenCalled();
    expect(notificationService.success).toHaveBeenCalledWith('south.items.all-deleted');
    expect(southConnectorService.deleteAllSouthItems).toHaveBeenCalledWith('id1');
  });
});
