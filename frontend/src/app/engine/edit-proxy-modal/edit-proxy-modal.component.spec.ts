import { EditProxyModalComponent } from './edit-proxy-modal.component';
import { ComponentTester, createMock } from 'ngx-speculoos';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { fakeAsync, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ProxyService } from '../../services/proxy.service';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { DefaultValidationErrorsComponent } from '../../components/shared/default-validation-errors/default-validation-errors.component';
import { ProxyCommandDTO, ProxyDTO } from '../../model/proxy.model';

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
      imports: [MockI18nModule, ReactiveFormsModule, HttpClientTestingModule, EditProxyModalComponent, DefaultValidationErrorsComponent],
      providers: [
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
      proxyService.createProxy.and.returnValue(of(createdProxy));

      tester.save.click();

      const expectedCommand: ProxyCommandDTO = {
        name: 'test',
        description: 'desc',
        address: 'http://localhost',
        username: '',
        password: ''
      };

      expect(proxyService.createProxy).toHaveBeenCalledWith(expectedCommand);
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
      proxyService.getProxy.and.returnValue(of(proxyToUpdate));

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
      proxyService.updateProxy.and.returnValue(of(undefined));

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

      expect(proxyService.updateProxy).toHaveBeenCalledWith('id1', expectedCommand);
      expect(proxyService.getProxy).toHaveBeenCalledWith('id1');
      expect(fakeActiveModal.close).toHaveBeenCalledWith(proxyToUpdate);
    }));

    it('should cancel', () => {
      tester.cancel.click();
      expect(fakeActiveModal.dismiss).toHaveBeenCalled();
    });
  });
});
