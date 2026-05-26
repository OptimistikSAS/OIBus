import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideRouter } from '@angular/router';

import { SouthListComponent } from './south-list.component';
import { SouthConnectorService } from '../services/south-connector.service';
import { ConfirmationService } from '../shared/confirmation.service';
import { NotificationService } from '../shared/notification.service';
import { ModalService } from '../shared/modal.service';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import testData from '../../../../backend/src/tests/utils/test-data';

const southConnectors = testData.south.list as unknown as Array<SouthConnectorLightDTO>;

describe('SouthListComponent', () => {
  let southConnectorService: MockObject<SouthConnectorService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    const confirmationService = createMock(ConfirmationService);
    notificationService = createMock(NotificationService);
    const modalService = createMock(ModalService);

    southConnectorService.list.mockReturnValue(of(southConnectors));
    southConnectorService.start.mockReturnValue(of(undefined));
    southConnectorService.stop.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: ConfirmationService, useValue: confirmationService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ModalService, useValue: modalService }
      ]
    });
  });

  test('should display a list', async () => {
    const fixture = TestBed.createComponent(SouthListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');
    await expect.element(rows).toHaveLength(southConnectors.length);
    await expect.element(rows.nth(0).getByCss('td').nth(1)).toHaveTextContent(southConnectors[0].name);
  });

  test('should toggle connector stop', () => {
    const fixture = TestBed.createComponent(SouthListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleConnector(southConnectors[0].id, southConnectors[0].name, false);

    expect(southConnectorService.stop).toHaveBeenCalledWith(southConnectors[0].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.stopped', { name: southConnectors[0].name });
  });

  test('should toggle connector start', () => {
    const fixture = TestBed.createComponent(SouthListComponent);
    fixture.detectChanges();

    fixture.componentInstance.toggleConnector(southConnectors[1].id, southConnectors[1].name, true);

    expect(southConnectorService.start).toHaveBeenCalledWith(southConnectors[1].id);
    expect(notificationService.success).toHaveBeenCalledWith('south.started', { name: southConnectors[1].name });
  });
});
