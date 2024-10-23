import { TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideRouter } from '@angular/router';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { of } from 'rxjs';
import { SouthConnectorLightDTO, SouthConnectorManifest } from '../../../../backend/shared/model/south-connector.model';
import { NorthConnectorLightDTO, NorthConnectorManifest } from '../../../../backend/shared/model/north-connector.model';
import { EngineService } from '../services/engine.service';

class HomeComponentTester extends ComponentTester<HomeComponent> {
  constructor() {
    super(HomeComponent);
  }

  get northTitle() {
    return this.element('#north-title');
  }

  get norths() {
    return this.elements('tbody.north tr');
  }

  get engineTitle() {
    return this.element('#engine-title');
  }

  get southTitle() {
    return this.element('#south-title');
  }

  get souths() {
    return this.elements('tbody.south tr');
  }
}

describe('HomeComponent', () => {
  let tester: HomeComponentTester;
  let southService: jasmine.SpyObj<SouthConnectorService>;
  let northService: jasmine.SpyObj<NorthConnectorService>;
  let engineService: jasmine.SpyObj<EngineService>;

  beforeEach(() => {
    southService = createMock(SouthConnectorService);
    northService = createMock(NorthConnectorService);
    engineService = createMock(EngineService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        { provide: SouthConnectorService, useValue: southService },
        { provide: NorthConnectorService, useValue: northService },
        { provide: EngineService, useValue: engineService }
      ]
    });

    southService.list.and.returnValue(
      of([
        { id: 'south1', name: 'south1', enabled: true },
        { id: 'south2', name: 'south2', enabled: false },
        { id: 'south3', name: 'south3', enabled: true }
      ] as Array<SouthConnectorLightDTO>)
    );

    northService.list.and.returnValue(
      of([
        { id: 'north1', name: 'north1', enabled: true },
        { id: 'north2', name: 'north2', enabled: false },
        { id: 'north3', name: 'north3', enabled: true }
      ] as Array<NorthConnectorLightDTO>)
    );
    northService.getNorthConnectorTypeManifest.and.returnValue(of({} as NorthConnectorManifest));
    southService.getSouthConnectorTypeManifest.and.returnValue(of({} as SouthConnectorManifest));

    tester = new HomeComponentTester();
    tester.detectChanges();
  });

  it('should display titles', () => {
    expect(tester.northTitle).toContainText('North');
    expect(tester.engineTitle).toContainText('Engine');
    expect(tester.southTitle).toContainText('South');
  });
});
