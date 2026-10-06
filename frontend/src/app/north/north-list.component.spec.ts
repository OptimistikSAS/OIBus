import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { of } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { provideI18nTesting } from '../../i18n/mock-i18n';
import testData from '../../test/test-data';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { NorthConnectorService } from '../services/north-connector.service';
import { AuditHistoryModalComponent } from '../shared/audit-history-modal/audit-history-modal.component';
import { MockModalService, provideModalTesting } from '../shared/mock-modal.service.testing';
import { NotificationService } from '../shared/notification.service';
import { NorthListComponent } from './north-list.component';

describe('NorthListComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;
  let modalService: MockModalService<AuditHistoryModalComponent>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    northConnectorService.list.mockReturnValue(of(testData.north.listLight));
    northConnectorService.start.mockReturnValue(of(undefined));
    northConnectorService.stop.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        provideModalTesting(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });
    modalService = TestBed.inject(MockModalService);
  });

  test('should display the north list', async () => {
    const fixture = TestBed.createComponent(NorthListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');
    await expect.element(rows).toHaveLength(testData.north.list.length);

    const firstRowCells = rows.nth(0).getByCss('td');
    await expect.element(firstRowCells.nth(1)).toMatchTextContent(testData.north.listLight[0].name);
  });

  test('should toggle north connector', async () => {
    const fixture = TestBed.createComponent(NorthListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const firstRowButtons = root.getByCss('tbody tr').nth(0).getByCss('button');
    await firstRowButtons.nth(0).click();

    const north = testData.north.listLight[0];
    if (north.enabled) {
      expect(northConnectorService.stop).toHaveBeenCalledWith(north.id);
      expect(notificationService.success).toHaveBeenCalledWith('north.stopped', { name: north.name });
    } else {
      expect(northConnectorService.start).toHaveBeenCalledWith(north.id);
      expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: north.name });
    }
  });

  test('should open the audit history modal with the north connector entity type and id', async () => {
    const fixture = TestBed.createComponent(NorthListComponent);
    fixture.detectChanges();

    const fakeModalComponent = createMock(AuditHistoryModalComponent);
    modalService.mockClosedModal(fakeModalComponent);

    const root = page.elementLocator(fixture.nativeElement);
    await root.getByCss('.show-audit-north').nth(0).click();

    const north = testData.north.listLight[0];
    expect(fakeModalComponent.prepare).toHaveBeenCalledWith('north_connector', north.id);
  });
});
