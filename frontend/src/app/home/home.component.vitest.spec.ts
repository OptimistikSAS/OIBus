import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { WindowService } from '../shared/window.service';
import { HomeComponent } from './home.component';
import { createMock, MockObject } from '../../test/vitest-create-mock';
import { SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import { NorthConnectorLightDTO } from '../../../../backend/shared/model/north-connector.model';

class HomeComponentTester {
  readonly fixture = TestBed.createComponent(HomeComponent);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly northTitle = this.root.getByCss('#north-title');
  readonly engineTitle = this.root.getByCss('#engine-title');
  readonly southTitle = this.root.getByCss('#south-title');
}

describe('HomeComponent', () => {
  let southService: MockObject<SouthConnectorService>;
  let northService: MockObject<NorthConnectorService>;
  let windowService: MockObject<WindowService>;

  beforeEach(() => {
    southService = createMock(SouthConnectorService);
    northService = createMock(NorthConnectorService);
    windowService = createMock(WindowService);
    windowService.getStorageItem.mockReturnValue('test-token');

    southService.list.mockReturnValue(
      of([
        { id: 'south1', name: 'south1', enabled: true },
        { id: 'south2', name: 'south2', enabled: false },
        { id: 'south3', name: 'south3', enabled: true }
      ] as Array<SouthConnectorLightDTO>)
    );

    northService.list.mockReturnValue(
      of([
        { id: 'north1', name: 'north1', enabled: true },
        { id: 'north2', name: 'north2', enabled: false },
        { id: 'north3', name: 'north3', enabled: true }
      ] as Array<NorthConnectorLightDTO>)
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: SouthConnectorService, useValue: southService },
        { provide: NorthConnectorService, useValue: northService },
        { provide: WindowService, useValue: windowService }
      ]
    });
  });

  test('should display titles', async () => {
    const tester = new HomeComponentTester();
    tester.fixture.detectChanges();
    await expect.element(tester.northTitle).toHaveTextContent('North');
    await expect.element(tester.engineTitle).toHaveTextContent('Engine');
    await expect.element(tester.southTitle).toHaveTextContent('South');
  });
});
