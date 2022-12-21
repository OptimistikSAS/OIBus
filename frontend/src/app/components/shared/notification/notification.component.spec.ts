import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';

import { NotificationService } from '../notification.service';
import { NotificationComponent } from './notification.component';
import { MockI18nModule } from '../../../../i18n/mock-i18n.spec';
import { NgbToastModule } from '@ng-bootstrap/ng-bootstrap';

class NotificationComponentTester extends ComponentTester<NotificationComponent> {
  constructor() {
    super(NotificationComponent);
  }

  get toasts() {
    return this.elements('ngb-toast')!;
  }
}

describe('NotificationComponent', () => {
  let tester: NotificationComponentTester;
  let notificationService: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [NotificationComponent, MockI18nModule, NgbToastModule]
    });
    tester = new NotificationComponentTester();
    notificationService = TestBed.inject(NotificationService);
    tester.detectChanges();
  });

  it('should not display initially', () => {
    expect(tester.toasts.length).toBe(0);
  });

  it('should display an i18ned success message and hide it after some seconds', fakeAsync(() => {
    notificationService.success('common.save');
    tester.detectChanges();
    tick(2500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-success');
    expect(tester.toasts[0]).toContainText('Save');

    notificationService.success('common.cancel');
    tester.detectChanges();
    expect(tester.toasts.length).toBe(2);

    tick(3000);
    tester.detectChanges();
    expect(tester.toasts.length).toBe(1);

    tick(5000);
    tester.detectChanges();
    expect(tester.toasts.length).toBe(0);
  }));

  it('should display an i18ned error message and hide it after some seconds', fakeAsync(() => {
    notificationService.error('common.save');
    tester.detectChanges();
    tick(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-danger');
    expect(tester.toasts[0]).toContainText('Save');
    tick(5000);
    tester.detectChanges();
    expect(tester.toasts.length).toBe(0);
  }));

  it('should display a non-i18ned error message and hide it after some seconds', fakeAsync(() => {
    notificationService.errorMessage('common.save');
    tester.detectChanges();
    tick(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-danger');
    expect(tester.toasts[0]).toContainText('common.save');
    tick(5000);
    tester.detectChanges();
    expect(tester.toasts.length).toBe(0);
  }));

  it('should display a success message with parameters', fakeAsync(() => {
    notificationService.success('engine.updated');
    tester.detectChanges();
    tick(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-success');
    expect(tester.toasts[0]).toContainText('Engine settings updated');
    tick(5000);
    tester.detectChanges();
    expect(tester.toasts.length).toBe(0);
  }));
});
