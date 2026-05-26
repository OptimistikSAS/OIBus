import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';

import { NorthListComponent } from './north-list.component';
import { NorthConnectorService } from '../services/north-connector.service';
import { NotificationService } from '../shared/notification.service';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { provideModalTesting } from '../shared/mock-modal.service.testing';
import { provideRouter } from '@angular/router';
import testData from '../../../../backend/src/tests/utils/test-data';
import { NorthConnectorLightDTO } from '../../../../backend/shared/model/north-connector.model';

describe('NorthListComponent', () => {
  let northConnectorService: MockObject<NorthConnectorService>;
  let notificationService: MockObject<NotificationService>;

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    northConnectorService.list.mockReturnValue(of(testData.north.list as unknown as Array<NorthConnectorLightDTO>));
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
  });

  test('should display the north list', async () => {
    const fixture = TestBed.createComponent(NorthListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const rows = root.getByCss('tbody tr');
    await expect.element(rows).toHaveLength(testData.north.list.length);

    const firstRowCells = rows.nth(0).getByCss('td');
    await expect.element(firstRowCells.nth(1)).toHaveTextContent((testData.north.list[0] as unknown as NorthConnectorLightDTO).name);
  });

  test('should toggle north connector', async () => {
    const fixture = TestBed.createComponent(NorthListComponent);
    fixture.detectChanges();

    const root = page.elementLocator(fixture.nativeElement);
    const firstRowButtons = root.getByCss('tbody tr').nth(0).getByCss('button');
    await firstRowButtons.nth(0).click();

    const north = testData.north.list[0] as unknown as NorthConnectorLightDTO;
    if (north.enabled) {
      expect(northConnectorService.stop).toHaveBeenCalledWith(north.id);
      expect(notificationService.success).toHaveBeenCalledWith('north.stopped', { name: north.name });
    } else {
      expect(northConnectorService.start).toHaveBeenCalledWith(north.id);
      expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: north.name });
    }
  });
});
