import { CreateHistoryQueryModalComponent } from './create-history-query-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { HistoryQueryService } from '../../services/history-query.service';
import { HistoryQueryDTO } from '../../../../../shared/model/history-query.model';
import { NorthConnectorDTO } from '../../../../../shared/model/north-connector.model';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';

class CreateHistoryQueryModalComponentTester extends ComponentTester<CreateHistoryQueryModalComponent> {
  constructor() {
    super(CreateHistoryQueryModalComponent);
  }

  get name() {
    return this.input('#history-query-name')!;
  }

  get description() {
    return this.textarea('#history-query-description')!;
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
      imports: [MockI18nModule, HttpClientTestingModule, CreateHistoryQueryModalComponent],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: HistoryQueryService, useValue: historyQueryService },
        { provide: Router, useValue: router }
      ]
    });
    tester = new CreateHistoryQueryModalComponentTester();

    historyQueryService.createHistoryQuery.and.returnValue(of({ id: 'historyId' } as HistoryQueryDTO));
    northConnectorService.getNorthConnectorTypes.and.returnValue(
      of([
        { category: 'database', type: 'MongoDB', description: 'MongoDB description', modes: { files: false, points: true } },
        { category: 'iot', type: 'MQTT', description: 'MQTT description', modes: { files: false, points: true } }
      ])
    );

    southConnectorService.getSouthConnectorTypes.and.returnValue(
      of([
        {
          category: 'database',
          type: 'SQL',
          description: 'SQL description',
          modes: { lastFile: false, lastPoint: false, subscription: true, historyFile: false, historyPoint: true }
        },
        {
          category: 'iot',
          type: 'OPCUA_HA',
          description: 'OPCUA description',
          modes: { lastFile: false, lastPoint: false, subscription: false, historyFile: false, historyPoint: true }
        },
        {
          category: 'iot',
          type: 'MQTT',
          description: 'MQTT description',
          modes: { lastFile: false, lastPoint: false, subscription: true, historyFile: false, historyPoint: false }
        }
      ])
    );
  });

  describe('with no existing connector', () => {
    beforeEach(() => {
      northConnectorService.getNorthConnectors.and.returnValue(of([]));
      southConnectorService.getSouthConnectors.and.returnValue(of([]));
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
      tester.name.fillWith('test');
      tester.description.fillWith('my description');
      tester.createButton.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: 'historyId'
      });
    });
  });

  describe('with existing connectors', () => {
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
    const southConnectors: Array<SouthConnectorDTO> = [
      {
        id: 'id1',
        type: 'SQL',
        name: 'South Connector1 ',
        description: 'My first South connector description',
        enabled: true,
        settings: {}
      },
      {
        id: 'id2',
        type: 'OPCUA_HA',
        name: 'South Connector 2',
        description: 'My second South connector description',
        enabled: true,
        settings: {}
      },
      {
        id: 'id3',
        type: 'MQTT',
        name: 'South Connector 3',
        description: 'My third South connector description',
        enabled: true,
        settings: {}
      }
    ];

    beforeEach(() => {
      northConnectorService.getNorthConnectors.and.returnValue(of(northConnectors));

      southConnectorService.getSouthConnectors.and.returnValue(of(southConnectors));
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

      tester.southIdSelect!.selectLabel('South Connector1 (SQL)');
      tester.northIdSelect!.selectLabel('myNorthConnector2 (Test)');
      tester.name.fillWith('test');
      tester.description.fillWith('my description');
      tester.createButton.click();

      expect(fakeActiveModal.close).toHaveBeenCalledWith({
        id: 'historyId'
      });
    });
  });

  it('should cancel', () => {
    tester.detectChanges();

    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
