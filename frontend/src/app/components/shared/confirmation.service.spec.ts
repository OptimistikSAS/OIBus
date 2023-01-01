import { TestBed } from '@angular/core/testing';
import { ConfirmationModalComponent } from './confirmation-modal/confirmation-modal.component';
import { ConfirmationOptions, ConfirmationService } from './confirmation.service';
import { MockModalModule, MockModalService } from './mock-modal.service.spec';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

describe('ConfirmationService', () => {
  let confirmationService: ConfirmationService;
  let mockModalService: MockModalService<ConfirmationModalComponent>;
  let confirmationModalComponent: ConfirmationModalComponent;
  const commonOptions = { message: 'world', title: 'Hello' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MockI18nModule, MockModalModule, ConfirmationModalComponent]
    });
    mockModalService = TestBed.inject(MockModalService);
    confirmationService = TestBed.inject(ConfirmationService);
    confirmationModalComponent = new ConfirmationModalComponent({} as NgbActiveModal);
  });

  it('should create a modal instance with title, message, yes and no', () => {
    mockModalService.mockClosedModal(confirmationModalComponent);

    let closed = false;
    confirmationService
      .confirm({
        ...commonOptions,
        yes: 'Yep',
        no: 'Nope'
      })
      .subscribe(() => (closed = true));

    expect(confirmationModalComponent.title).toBe('Hello');
    expect(confirmationModalComponent.message).toBe('world');
    expect(confirmationModalComponent.yes).toBe('Yep');
    expect(confirmationModalComponent.no).toBe('Nope');
    expect(closed).toBe(true);
  });

  it('should create a modal instance with i18n title, message, yes and no', () => {
    mockModalService.mockClosedModal(confirmationModalComponent);

    let closed = false;
    const options: ConfirmationOptions = {
      titleKey: 'common.save',
      messageKey: 'common.close',
      yesKey: 'common.cancel',
      noKey: 'common.delete'
    };
    confirmationService.confirm(options).subscribe(() => (closed = true));

    expect(confirmationModalComponent.title).toBe('Save');
    expect(confirmationModalComponent.message).toBe('Close');
    expect(confirmationModalComponent.yes).toBe('Cancel');
    expect(confirmationModalComponent.no).toBe('Delete');
    expect(closed).toBe(true);
  });

  it('should use default title, yes and no keys', () => {
    mockModalService.mockClosedModal(confirmationModalComponent);

    let closed = false;
    const options: ConfirmationOptions = {
      message: 'Hello'
    };
    confirmationService.confirm(options).subscribe(() => (closed = true));

    expect(confirmationModalComponent.title).toBe('Confirmation');
    expect(confirmationModalComponent.message).toBe('Hello');
    expect(confirmationModalComponent.yes).toBe('Yes');
    expect(confirmationModalComponent.no).toBe('No');
    expect(closed).toBe(true);
  });

  it('should do nothing on No', () => {
    mockModalService.mockDismissedModal(confirmationModalComponent);

    let closed = false;
    confirmationService.confirm(commonOptions).subscribe(() => (closed = true));

    expect(closed).toBe(false);
  });

  it('should emit an error if on No if options says so', () => {
    mockModalService.mockDismissedWithErrorModal(confirmationModalComponent);

    let hasErrored = false;
    const options: ConfirmationOptions = { ...commonOptions, errorOnClose: true };
    confirmationService.confirm(options).subscribe({ error: () => (hasErrored = true) });

    expect(hasErrored).toBe(true);
  });
});
