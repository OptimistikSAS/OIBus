import { CreateNorthConnectorModalComponent } from './create-north-connector-modal.component';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';

class CreateNorthConnectorModalComponentTester extends ComponentTester<CreateNorthConnectorModalComponent> {
  constructor() {
    super(CreateNorthConnectorModalComponent);
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

describe('CreateNorthConnectorModalComponent', () => {
  let tester: CreateNorthConnectorModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    router = createMock(Router);

    TestBed.configureTestingModule({
      imports: [MockI18nModule, HttpClientTestingModule, CreateNorthConnectorModalComponent],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: Router, useValue: router }
      ]
    });

    northConnectorService.getNorthConnectorTypes.and.returnValue(
      of([
        { category: 'database', type: 'MongoDB', description: 'MongoDB description' },
        { category: 'iot', type: 'MQTT', description: 'MQTT description' }
      ])
    );

    tester = new CreateNorthConnectorModalComponentTester();
    tester.detectChanges();
  });

  it('should choose', () => {
    expect(tester.categoryButtons.length).toBe(2);
    const button = tester.categoryButtons[0] as TestButton;
    button.click();

    expect(fakeActiveModal.close).toHaveBeenCalled();
    expect(fakeActiveModal.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/north', 'create'], { queryParams: { type: 'MongoDB' } });
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
