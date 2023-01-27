import { CreateHistoryQueryModalComponent } from './create-history-query-modal.component';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';

class CreateHistoryQueryModalComponentTester extends ComponentTester<CreateHistoryQueryModalComponent> {
  constructor() {
    super(CreateHistoryQueryModalComponent);
  }

  get categoryButtons() {
    return this.elements('button.category-button');
  }

  get createButton() {
    return this.button('#create-button')!;
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
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    southConnectorService = createMock(SouthConnectorService);
    router = createMock(Router);

    TestBed.configureTestingModule({
      imports: [MockI18nModule, HttpClientTestingModule, CreateHistoryQueryModalComponent],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: Router, useValue: router }
      ]
    });

    northConnectorService.getNorthConnectorTypes.and.returnValue(
      of([
        { category: 'database', type: 'MongoDB', description: 'MongoDB description', modes: { files: false, points: true } },
        { category: 'iot', type: 'MQTT', description: 'MQTT description', modes: { files: false, points: true } }
      ])
    );
    northConnectorService.getNorthConnectors.and.returnValue(of([]));

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
    southConnectorService.getSouthConnectors.and.returnValue(of([]));

    tester = new CreateHistoryQueryModalComponentTester();
    tester.detectChanges();
  });

  it('should choose', () => {
    // 2 North types and 2 South types
    expect(tester.categoryButtons.length).toBe(4);
    const southCategoryButton = tester.categoryButtons[0] as TestButton;
    southCategoryButton.click();

    const northButton = tester.categoryButtons[2] as TestButton;
    northButton.click();

    tester.createButton.click();

    expect(fakeActiveModal.close).toHaveBeenCalledWith({ northType: 'MongoDB', southType: 'SQL' });
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
