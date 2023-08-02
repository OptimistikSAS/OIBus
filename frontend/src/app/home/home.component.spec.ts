import { TestBed } from '@angular/core/testing';

import { HomeComponent } from './home.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideRouter } from '@angular/router';
import { SouthConnectorService } from '../services/south-connector.service';
import { NorthConnectorService } from '../services/north-connector.service';
import { of } from 'rxjs';
import { SouthConnectorDTO } from '../../../../shared/model/south-connector.model';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';
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
        { name: 'south1', enabled: true },
        { name: 'south2', enabled: false },
        { name: 'south3', enabled: true }
      ] as Array<SouthConnectorDTO>)
    );

    northService.list.and.returnValue(
      of([
        { name: 'north1', enabled: true },
        { name: 'north2', enabled: false },
        { name: 'north2', enabled: true }
      ] as Array<NorthConnectorDTO>)
    );

    tester = new HomeComponentTester();
    tester.detectChanges();
  });

  it('should display titles', () => {
    expect(tester.northTitle).toContainText('North');
    expect(tester.engineTitle).toContainText('Engine');
    expect(tester.southTitle).toContainText('South');
  });
});
