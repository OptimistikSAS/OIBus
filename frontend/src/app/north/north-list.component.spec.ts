import { TestBed } from '@angular/core/testing';

import { NorthListComponent } from './north-list.component';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { NorthConnectorService } from '../services/north-connector.service';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NorthConnectorLightDTO } from '../../../../backend/shared/model/north-connector.model';
import { NotificationService } from '../shared/notification.service';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
  let notificationService: jasmine.SpyObj<NotificationService>;

  const northConnectors: Array<NorthConnectorLightDTO> = [
    {
      id: 'id1',
      name: 'myNorthConnector1',
      description: 'a test north connector',
      enabled: true,
      type: 'file-writer'
    },
    {
      id: 'id2',
      name: 'myNorthConnector2',
      description: 'a test north connector',
      enabled: false,
      type: 'file-writer'
    }
  ];

  beforeEach(async () => {
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    northConnectorService.list.and.returnValue(of(northConnectors));
    northConnectorService.start.and.returnValue(of(undefined));
    northConnectorService.stop.and.returnValue(of(undefined));

    tester = new NorthListComponentTester();
    await tester.change();
  });

  it('should display the north  list', () => {
    expect(tester.title).toContainText('North list');
    expect(tester.northList.length).toBe(2);
    expect(tester.northList[0].elements('td')[1]).toContainText(northConnectors[0].name);
    expect(tester.northList[0].elements('td')[2]).toContainText('File writer');
    expect(tester.northList[0].elements('td')[3]).toContainText(northConnectors[0].description);
    expect(tester.northList[0].elements('td')[4].elements('a').length).toBe(3);
    expect(tester.northList[0].elements('td')[4].elements('button').length).toBe(2);
    expect(tester.northList[1].elements('td')[1]).toContainText(northConnectors[1].name);
    expect(tester.northList[1].elements('td')[2]).toContainText('File writer');
    expect(tester.northList[1].elements('td')[3]).toContainText(northConnectors[1].description);
    expect(tester.northList[1].elements('td')[4].elements('a').length).toBe(3);
    expect(tester.northList[1].elements('td')[4].elements('button').length).toBe(2);
  });

  it('should toggle north connector', () => {
    const toggle1 = tester.northList[0].elements('td')[4].elements('button')[0] as TestButton;
    toggle1.click();
    expect(northConnectorService.stop).toHaveBeenCalledWith('id1');
    expect(notificationService.success).toHaveBeenCalledWith('north.stopped', { name: northConnectors[0].name });

    const toggle2 = tester.northList[1].elements('td')[4].elements('button')[0] as TestButton;
    toggle2.click();
    expect(northConnectorService.start).toHaveBeenCalledWith('id2');
    expect(notificationService.success).toHaveBeenCalledWith('north.started', { name: northConnectors[1].name });
  });
});
