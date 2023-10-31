import { CreateNorthSubscriptionModalComponent } from './create-north-subscription-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { SouthConnectorDTO } from '../../../../../shared/model/south-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { ExternalSourceDTO } from '../../../../../shared/model/external-sources.model';
import { NotificationService } from '../../shared/notification.service';

class CreateNorthSubscriptionModalComponentTester extends ComponentTester<CreateNorthSubscriptionModalComponent> {
  constructor() {
    super(CreateNorthSubscriptionModalComponent);
  }

  get south() {
    return this.select('#south')!;
  }

  get externalSource() {
    return this.select('#external-source')!;
  }

  get type() {
    return this.select('#type')!;
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

  const southConnectors: Array<SouthConnectorDTO> = [
    { id: 'id1', name: 'South1' } as SouthConnectorDTO,
    { id: 'id2', name: 'South2' } as SouthConnectorDTO
  ];
  const externalSources: Array<ExternalSourceDTO> = [
    { id: 'idRef1', reference: 'Reference1' } as ExternalSourceDTO,
    { id: 'idRef2', reference: 'Reference2' } as ExternalSourceDTO
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
    tester.componentInstance.prepareForCreation(southConnectors, externalSources);
    northConnectorService.createSubscription.and.returnValue(of(undefined));
    northConnectorService.createExternalSubscription.and.returnValue(of(undefined));
    tester.detectChanges();
  });

  it('should have an empty form', () => {
    expect(tester.type).toBeDefined();
    expect(tester.externalSource).toBeDefined();
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

    const expectedSouth: SouthConnectorDTO = {
      id: 'id2',
      name: 'South2'
    } as SouthConnectorDTO;

    expect(tester.type).toContainText('South connector');
    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      type: 'south',
      subscription: expectedSouth,
      externalSubscription: undefined
    });
  }));

  it('should save external subscription if valid', fakeAsync(() => {
    tester.type.selectLabel('External source');
    tester.externalSource.selectLabel('Reference2');
    tester.save.click();

    const expectedReference: ExternalSourceDTO = {
      id: 'idRef2',
      reference: 'Reference2'
    } as ExternalSourceDTO;

    expect(tester.type).toContainText('External source');
    expect(fakeActiveModal.close).toHaveBeenCalledWith({
      type: 'external-source',
      subscription: undefined,
      externalSubscription: expectedReference
    });
  }));

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
