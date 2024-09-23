import { CreateHistoryQueryModalComponent } from './create-history-query-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { NorthConnectorLightDTO } from '../../../../../shared/model/north-connector.model';
import { SouthConnectorLightDTO } from '../../../../../shared/model/south-connector.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { SouthItemSettings, SouthSettings } from '../../../../../shared/model/south-settings.model';
import { NorthSettings } from '../../../../../shared/model/north-settings.model';

class CreateHistoryQueryModalComponentTester extends ComponentTester<CreateHistoryQueryModalComponent> {
  constructor() {
    super(CreateHistoryQueryModalComponent);
  }

  get fromExistingSouth() {
    return this.input('#from-existing-south')!;
  }

  get fromExistingNorth() {
    return this.input('#from-existing-north')!;
  }

  get southIdSelect() {
    return this.select('#south-connector');
  }

  get southTypeSelect() {
    return this.select('#south-type');
  }

  get northIdSelect() {
    return this.select('#north-connector');
  }

  get northTypeSelect() {
    return this.select('#north-type');
  }

  get createButton() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('CreateHistoryQueryModalComponent', () => {
  let tester: CreateHistoryQueryModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let historyQueryService: jasmine.SpyObj<HistoryQueryService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    historyQueryService = createMock(HistoryQueryService);
    router = createMock(Router);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: Router, useValue: router }
      ]
    });
    tester = new CreateHistoryQueryModalComponentTester();

    historyQueryService.create.and.returnValue(of({ id: 'historyId' } as HistoryQueryDTO<SouthSettings, NorthSettings, SouthItemSettings>));
    northConnectorService.getNorthConnectorTypes.and.returnValue(
      of([
        { id: 'mongodb', category: 'database', name: 'MongoDB', description: 'MongoDB description', modes: { files: false, points: true } },
        { id: 'mqtt', category: 'iot', name: 'MQTT', description: 'MQTT description', modes: { files: false, points: true } }
      ])
    );

    southConnectorService.getAvailableTypes.and.returnValue(
      of([
        {
          id: 'mssql',
          category: 'database',
          name: 'SQL',
          description: 'SQL description',
          modes: { lastFile: false, lastPoint: false, subscription: true, history: true }
        },
        {
          id: 'opcua-ha',
          category: 'iot',
          name: 'OPCUA_HA',
          description: 'OPCUA description',
          modes: { lastFile: false, lastPoint: false, subscription: false, history: true }
        },
        {
          id: 'mqtt',
          category: 'iot',
          name: 'MQTT',
          description: 'MQTT description',
          modes: { lastFile: false, lastPoint: false, subscription: true, history: false }
        }
      ])
    );
  });

  describe('with no existing connector', () => {
    beforeEach(() => {
      northConnectorService.list.and.returnValue(of([]));
      southConnectorService.list.and.returnValue(of([]));
      tester.detectChanges();
    });

    it('should choose from new connectors', () => {
      expect(tester.fromExistingSouth.checked).toBeFalsy();
      expect(tester.fromExistingSouth.disabled).toBeTruthy();
      expect(tester.fromExistingNorth.checked).toBeFalsy();
      expect(tester.fromExistingNorth.disabled).toBeTruthy();

      expect(tester.southIdSelect).toBeNull();
      expect(tester.northIdSelect).toBeNull();

      expect(tester.southTypeSelect!.optionLabels.length).toBe(2);
      expect(tester.northTypeSelect!.optionLabels.length).toBe(2);

      tester.southTypeSelect!.selectLabel('SQL');
      tester.northTypeSelect!.selectLabel('MongoDB');
      tester.createButton.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        northType: 'mongodb',
        southType: 'mssql',
        northId: null,
        southId: null
      });
    });
  });

  describe('with existing connectors', () => {
    const northConnectors: Array<NorthConnectorLightDTO> = [
      {
        id: 'id1',
        name: 'myNorthConnector1',
        description: 'a test north connector',
        enabled: true,
        type: 'test'
      },
      {
        id: 'id2',
        name: 'myNorthConnector2',
        description: 'a test north connector',
        enabled: true,
        type: 'test'
      }
    ];
    const southConnectors: Array<SouthConnectorLightDTO> = [
      {
        id: 'id1',
        type: 'mssql',
        name: 'South Connector1 ',
        description: 'My first South connector description',
        enabled: true
      },
      {
        id: 'id2',
        type: 'opcua-ha',
        name: 'South Connector 2',
        description: 'My second South connector description',
        enabled: true
      },
      {
        id: 'id3',
        type: 'mqtt',
        name: 'South Connector 3',
        description: 'My third South connector description',
        enabled: true
      }
    ];

    beforeEach(() => {
      northConnectorService.list.and.returnValue(of(northConnectors));

      southConnectorService.list.and.returnValue(of(southConnectors));
      tester.detectChanges();
    });

    it('should choose from existing connectors', () => {
      expect(tester.fromExistingSouth.checked).toBeTruthy();
      expect(tester.fromExistingSouth.disabled).toBeFalsy();
      expect(tester.fromExistingNorth.checked).toBeTruthy();
      expect(tester.fromExistingNorth.disabled).toBeFalsy();

      expect(tester.southTypeSelect).toBeNull();
      expect(tester.northTypeSelect).toBeNull();

      expect(tester.southIdSelect!.optionLabels.length).toBe(2);
      expect(tester.northIdSelect!.optionLabels.length).toBe(2);

      tester.southIdSelect!.selectLabel('South Connector1 (mssql)');
      tester.northIdSelect!.selectLabel('myNorthConnector2 (test)');
      tester.createButton.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        northType: null,
        southType: null,
        northId: 'id2',
        southId: 'id1'
      });
    });
  });

  it('should cancel', () => {
    tester.detectChanges();

    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
