import { TestBed } from '@angular/core/testing';

import { NorthListComponent } from './north-list.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';
import { NorthConnectorService } from '../services/north-connector.service';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { NorthConnectorDTO } from '../../../../shared/model/north-connector.model';

class NorthListComponentTester extends ComponentTester<NorthListComponent> {
  constructor() {
    super(NorthListComponent);
  }

  get title() {
    return this.element('h1');
  }

  get northList() {
    return this.elements('tbody tr');
  }
}
describe('NorthListComponent', () => {
  let tester: NorthListComponentTester;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;

  const northConnectors: Array<NorthConnectorDTO> = [
    {
      id: 'id1',
      name: 'myNorthConnector1',
      description: 'a test north connector',
      enabled: true,
      type: 'Test'
    } as NorthConnectorDTO,
    {
      id: 'id2',
      name: 'myNorthConnector2',
      description: 'a test north connector',
      enabled: true,
      type: 'Test'
    } as NorthConnectorDTO
  ];

  beforeEach(() => {
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      imports: [NorthListComponent],
      providers: [
        provideTestingI18n(),
        provideRouter([]),
        provideHttpClient(),
        { provide: NorthConnectorService, useValue: northConnectorService }
      ]
    });

    northConnectorService.getNorthConnectors.and.returnValue(of(northConnectors));

    tester = new NorthListComponentTester();
    tester.detectChanges();
  });

  it('should display title', () => {
    expect(tester.title).toContainText('North list');
    expect(tester.northList.length).toBe(2);
    expect(tester.northList[0].elements('td')[0]).toContainText(northConnectors[0].name);
    expect(tester.northList[0].elements('td')[1]).toContainText(northConnectors[0].type);
    expect(tester.northList[0].elements('td')[2]).toContainText(northConnectors[0].description);
    expect(tester.northList[0].elements('td')[3].elements('button').length).toBe(4);
    expect(tester.northList[1].elements('td')[0]).toContainText(northConnectors[1].name);
    expect(tester.northList[1].elements('td')[1]).toContainText(northConnectors[1].type);
    expect(tester.northList[1].elements('td')[2]).toContainText(northConnectors[1].description);
    expect(tester.northList[1].elements('td')[3].elements('button').length).toBe(4);
  });
});
