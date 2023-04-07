import { CreateNorthSubscriptionModalComponent } from './create-north-subscription-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of } from 'rxjs';

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

  const southConnectors: Array<SouthConnectorDTO> = [
    { id: 'id1', name: 'South1' } as SouthConnectorDTO,
    { id: 'id2', name: 'South2' } as SouthConnectorDTO
  ];

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);

    TestBed.configureTestingModule({
      imports: [
        MockI18nModule,
        ReactiveFormsModule,
        HttpClientTestingModule,
        CreateNorthSubscriptionModalComponent,
        DefaultValidationErrorsComponent
      ],
      providers: [
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: NorthConnectorService, useValue: northConnectorService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new CreateNorthSubscriptionModalComponentTester();
    tester.componentInstance.prepareForCreation('northId', southConnectors);
    northConnectorService.createNorthConnectorSubscription.and.returnValue(of(undefined));
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

  it('should save if valid', fakeAsync(() => {
    tester.south.selectLabel('South2');
    tester.save.click();

    const expectedSouth: SouthConnectorDTO = {
      id: 'id2',
      name: 'South2'
    } as SouthConnectorDTO;

    expect(northConnectorService.createNorthConnectorSubscription).toHaveBeenCalledWith('northId', expectedSouth.id);
    expect(fakeActiveModal.close).toHaveBeenCalledWith(expectedSouth);
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
