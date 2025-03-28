import { ChooseSouthConnectorTypeModalComponent } from './choose-south-connector-type-modal.component';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { SouthConnectorService } from '../../services/south-connector.service';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class ChooseSouthConnectorTypeModalComponentTester extends ComponentTester<ChooseSouthConnectorTypeModalComponent> {
  constructor() {
    super(ChooseSouthConnectorTypeModalComponent);
  }

  get categoryButtons() {
    return this.elements('button.category-button');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('ChooseSouthConnectorTypeModalComponent', () => {
  let tester: ChooseSouthConnectorTypeModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let southConnectorService: jasmine.SpyObj<SouthConnectorService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    southConnectorService = createMock(SouthConnectorService);
    router = createMock(Router);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: SouthConnectorService, useValue: southConnectorService },
        { provide: Router, useValue: router }
      ]
    });

    southConnectorService.getAvailableTypes.and.returnValue(
      of([
        {
          id: 'mssql',
          category: 'database',
          modes: { lastFile: false, lastPoint: false, subscription: true, history: true }
        },
        {
          id: 'mqtt',
          category: 'iot',
          modes: { lastFile: false, lastPoint: false, subscription: true, history: true }
        }
      ])
    );

    tester = new ChooseSouthConnectorTypeModalComponentTester();
    tester.detectChanges();
  });

  it('should choose', () => {
    expect(tester.categoryButtons.length).toBe(2);
    const button = tester.categoryButtons[0] as TestButton;
    button.click();

    expect(fakeActiveModal.close).toHaveBeenCalled();
    expect(fakeActiveModal.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/south', 'create'], { queryParams: { type: 'mssql' } });
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
