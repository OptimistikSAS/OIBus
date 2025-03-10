import { CreateNorthSubscriptionModalComponent } from './create-north-subscription-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorLightDTO } from '../../../../../backend/shared/model/south-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { NotificationService } from '../../shared/notification.service';

class CreateNorthSubscriptionModalComponentTester extends ComponentTester<CreateNorthSubscriptionModalComponent> {
  constructor() {
    super(CreateNorthSubscriptionModalComponent);
  }

  get south() {
    return this.select('#south')!;
  }

  get validationErrors() {
    return this.elements('val-errors div');
  }

  get save() {
    return this.button('#save-button')!;
  }

  get cancel() {
    return this.button('#cancel-button')!;
  }
}

describe('CreateNorthSubscriptionModalComponent', () => {
  let tester: CreateNorthSubscriptionModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let notificationService: jasmine.SpyObj<NotificationService>;

  const southConnectors: Array<SouthConnectorLightDTO> = [
    { id: 'id1', name: 'South1' } as SouthConnectorLightDTO,
    { id: 'id2', name: 'South2' } as SouthConnectorLightDTO
  ];

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    notificationService = createMock(NotificationService);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: NotificationService, useValue: notificationService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new CreateNorthSubscriptionModalComponentTester();
    tester.componentInstance.prepareForCreation(southConnectors);
    northConnectorService.createSubscription.and.returnValue(of(undefined));
    tester.detectChanges();
  });

  it('should have an empty form', () => {
    expect(tester.south).toBeDefined();
  });

  it('should not save if invalid', () => {
    tester.save.click();

    // south
    expect(tester.validationErrors.length).toBe(1);
    expect(fakeActiveModal.close).not.toHaveBeenCalled();
  });

  it('should save south subscription if valid', fakeAsync(() => {
    tester.south.selectLabel('South2');
    tester.save.click();

    const expectedSouth: SouthConnectorLightDTO = {
      id: 'id2',
      name: 'South2'
    } as SouthConnectorLightDTO;

    expect(fakeActiveModal.close).toHaveBeenCalledWith(expectedSouth);
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
