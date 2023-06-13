import { EditProxyModalComponent } from './edit-proxy-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ProxyService } from '../../services/proxy.service';
import { DefaultValidationErrorsComponent } from '../../shared/default-validation-errors/default-validation-errors.component';
import { ProxyCommandDTO, ProxyDTO } from '../../../../../shared/model/proxy.model';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

class EditProxyModalComponentTester extends ComponentTester<EditProxyModalComponent> {
  constructor() {
    super(EditProxyModalComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get description() {
    return this.textarea('#description')!;
  }

  get address() {
    return this.input('#address')!;
  }

  get username() {
    return this.input('#username')!;
  }

  get password() {
    return this.input('#password')!;
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

describe('EditProxyModalComponent', () => {
  let tester: EditProxyModalComponentTester;
  let fakeActiveModal: NgbActiveModal;
  let proxyService: jasmine.SpyObj<ProxyService>;

  beforeEach(() => {
    fakeActiveModal = createMock(NgbActiveModal);
    proxyService = createMock(ProxyService);

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, HttpClientTestingModule, EditProxyModalComponent, DefaultValidationErrorsComponent],
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: fakeActiveModal },
        { provide: ProxyService, useValue: proxyService }
      ]
    });

    TestBed.createComponent(DefaultValidationErrorsComponent).detectChanges();

    tester = new EditProxyModalComponentTester();
  });

  describe('create mode', () => {
    beforeEach(() => {
      tester.componentInstance.prepareForCreation();
      tester.detectChanges();
    });

    it('should have an empty form', () => {
      expect(tester.name).toHaveValue('');
      expect(tester.description).toHaveValue('');
      expect(tester.address).toHaveValue('');
      expect(tester.username).toHaveValue('');
      expect(tester.password).toHaveValue('');
    });

    it('should not save if invalid', () => {
      tester.save.click();

      // name, address
      expect(tester.validationErrors.length).toBe(2);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      tester.name.fillWith('test');
      tester.description.fillWith('desc');
      tester.address.fillWith('http://localhost');

      tester.detectChanges();

      const createdProxy = {
        id: 'id1'
      } as ProxyDTO;
      proxyService.create.and.returnValue(of(createdProxy));

      tester.save.click();

      const expectedCommand: ProxyCommandDTO = {
        name: 'test',
        description: 'desc',
        address: 'http://localhost',
        username: '',
        password: ''
      };

      expect(proxyService.create).toHaveBeenCalledWith(expectedCommand);
      expect(fakeActiveModal.close).toHaveBeenCalledWith(createdProxy);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    const proxyToUpdate: ProxyDTO = {
      id: 'id1',
      name: 'proxy1',
      description: 'My Proxy 1',
      address: 'http://localhost',
      username: 'user',
      password: 'pass'
    };

    beforeEach(() => {
      proxyService.get.and.returnValue(of(proxyToUpdate));

      tester.componentInstance.prepareForEdition(proxyToUpdate);
      tester.detectChanges();
    });

    it('should have a populated form', () => {
      expect(tester.name).toHaveValue(proxyToUpdate.name);
      expect(tester.description).toHaveValue(proxyToUpdate.description);
    });

    it('should not save if invalid', () => {
      tester.name.fillWith('');
      tester.save.click();

      // name
      expect(tester.validationErrors.length).toBe(1);
      expect(fakeActiveModal.close).not.toHaveBeenCalled();
    });

    it('should save if valid', fakeAsync(() => {
      proxyService.update.and.returnValue(of(undefined));

      tester.name.fillWith('Proxy 1 (updated)');
      tester.description.fillWith('A longer and updated description of my Proxy');

      tester.save.click();

      const expectedCommand: ProxyCommandDTO = {
        name: 'Proxy 1 (updated)',
        description: 'A longer and updated description of my Proxy',
        address: proxyToUpdate.address,
        username: proxyToUpdate.username,
        password: proxyToUpdate.password
      };

      expect(proxyService.update).toHaveBeenCalledWith('id1', expectedCommand);
      expect(proxyService.get).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(proxyToUpdate);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
