import { ChooseNorthConnectorTypeModalComponent } from './choose-north-connector-type-modal.component';
import { ComponentTester, createMock, TestButton } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { NorthConnectorService } from '../../services/north-connector.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class ChooseNorthConnectorTypeModalComponentTester extends ComponentTester<ChooseNorthConnectorTypeModalComponent> {
  constructor() {
    super(ChooseNorthConnectorTypeModalComponent);
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

describe('ChooseNorthConnectorTypeModal', () => {
  let tester: ChooseNorthConnectorTypeModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let northConnectorService: jasmine.SpyObj<NorthConnectorService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    northConnectorService = createMock(NorthConnectorService);
    router = createMock(Router);

    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: NorthConnectorService, useValue: northConnectorService },
        { provide: Router, useValue: router }
      ]
    });

    northConnectorService.getNorthConnectorTypes.and.returnValue(
      of([
        {
          id: 'file-writer',
          category: 'file',
          name: 'File Writer',
          description: 'File Writer description',
          types: ['raw']
        },
        { id: 'console', category: 'debug', name: 'Console', description: 'Console description', types: ['raw'] }
      ])
    );

    tester = new ChooseNorthConnectorTypeModalComponentTester();
    tester.detectChanges();
  });

  it('should choose', () => {
    expect(tester.categoryButtons.length).toBe(2);
    const button = tester.categoryButtons[0] as TestButton;
    button.click();

    expect(fakeActiveModal.close).toHaveBeenCalled();
    expect(fakeActiveModal.close).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/north', 'create'], { queryParams: { type: 'file-writer' } });
  });

  it('should cancel', () => {
    tester.cancel.click();
    expect(fakeActiveModal.dismiss).toHaveBeenCalled();
  });
});
