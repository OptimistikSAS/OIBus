import { TestBed } from '@angular/core/testing';

import { SouthListComponent } from './south-list.component';
import { provideI18nTesting } from '../../i18n/mock-i18n';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { SouthConnectorService } from '../services/south-connector.service';
import { of } from 'rxjs';
import { SouthConnectorLightDTO } from '../../../../backend/shared/model/south-connector.model';
import { NotificationService } from '../shared/notification.service';

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
  let notificationService: jasmine.SpyObj<NotificationService>;

  const southConnectors: Array<SouthConnectorLightDTO> = [
    {
      id: 'id1',
      type: 'Generic',
      name: 'South Connector1',
      description: 'My first South connector description',
      enabled: true
    },
    {
      id: 'id2',
      type: 'Generic',
      name: 'South Connector 2',
      description: 'My second South connector description',
      enabled: false
    }
  ];

  beforeEach(() => {
    southConnectorService = createMock(SouthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        provideRouter([]),
        provideHttpClient(),
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    southConnectorService.list.and.returnValue(of(southConnectors));
    southConnectorService.startSouth.and.returnValue(of(undefined));
    southConnectorService.stopSouth.and.returnValue(of(undefined));

    tester = new SouthListComponentTester();
    tester.detectChanges();
  });

  it('should display a list', () => {
    expect(tester.title).toContainText('South list');
    expect(tester.southList.length).toBe(2);
    expect(tester.southList[0].elements('td')[1]).toContainText(southConnectors[0].name);
    expect(tester.southList[0].elements('td')[2]).toContainText(southConnectors[0].type);
    expect(tester.southList[0].elements('td')[3]).toContainText(southConnectors[0].description);
    expect(tester.southList[0].elements('td')[4].elements('button').length).toBe(2);
    expect(tester.southList[0].elements('td')[4].elements('a').length).toBe(3);
    expect(tester.southList[1].elements('td')[1]).toContainText(southConnectors[1].name);
    expect(tester.southList[1].elements('td')[2]).toContainText(southConnectors[1].type);
    expect(tester.southList[1].elements('td')[3]).toContainText(southConnectors[1].description);
    expect(tester.southList[1].elements('td')[4].elements('button').length).toBe(2);
    expect(tester.southList[1].elements('td')[4].elements('a').length).toBe(3);
  });

  it('should toggle south connector', () => {
    const toggle1 = tester.southList[0].elements('td')[4].elements('button')[0] as TestButton;
    toggle1.click();
    expect(southConnectorService.stopSouth).toHaveBeenCalledWith('id1');
    expect(notificationService.success).toHaveBeenCalledWith('south.stopped', { name: southConnectors[0].name });

    const toggle2 = tester.southList[1].elements('td')[4].elements('button')[0] as TestButton;
    toggle2.click();
    expect(southConnectorService.startSouth).toHaveBeenCalledWith('id2');
    expect(notificationService.success).toHaveBeenCalledWith('south.started', { name: southConnectors[1].name });
  });
});
