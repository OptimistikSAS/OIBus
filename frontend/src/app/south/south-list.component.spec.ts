import { TestBed } from '@angular/core/testing';

import { SouthListComponent } from './south-list.component';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { SouthConnectorService } from '../services/south-connector.service';
import { of } from 'rxjs';
import { SouthConnectorDTO } from '../model/south-connector.model';

class SouthListComponentTester extends ComponentTester<SouthListComponent> {
  constructor() {
    super(SouthListComponent);
  }

  get title() {
    return this.element('h1');
  }

  get southList() {
    return this.elements('tbody tr');
  }
}
describe('SouthListComponent', () => {
  let tester: SouthListComponentTester;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;

  const southConnectors: Array<SouthConnectorDTO> = [
    {
      id: 'id1',
      type: 'Generic',
      name: 'South Connector1 ',
      description: 'My first South connector description',
      enabled: true,
      settings: {}
    },
    {
      id: 'id2',
      type: 'Generic',
      name: 'South Connector 2',
      description: 'My second South connector description',
      enabled: true,
      settings: {}
    }
  ];

  beforeEach(async () => {
    southConnectorService = createMock(SouthConnectorService);

    TestBed.configureTestingModule({
      imports: [SouthListComponent],
      providers: [
        provideTestingI18n(),
        provideRouter([]),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService }
      ]
    });

    southConnectorService.getSouthConnectors.and.returnValue(of(southConnectors));

    tester = new SouthListComponentTester();
    tester.detectChanges();
  });

  it('should display a list', () => {
    expect(tester.title).toContainText('South list');
    expect(tester.southList.length).toBe(2);
    expect(tester.southList[0].elements('td')[0]).toContainText(southConnectors[0].name);
    expect(tester.southList[0].elements('td')[1]).toContainText(southConnectors[0].type);
    expect(tester.southList[0].elements('td')[2]).toContainText(southConnectors[0].description);
    expect(tester.southList[0].elements('td')[3].elements('button').length).toBe(4);
    expect(tester.southList[1].elements('td')[0]).toContainText(southConnectors[1].name);
    expect(tester.southList[1].elements('td')[1]).toContainText(southConnectors[1].type);
    expect(tester.southList[1].elements('td')[2]).toContainText(southConnectors[1].description);
    expect(tester.southList[1].elements('td')[3].elements('button').length).toBe(4);
  });
});
