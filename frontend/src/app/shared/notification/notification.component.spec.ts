import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ComponentTester } from 'ngx-speculoos';

import { NotificationService } from '../notification.service';
import { NotificationComponent } from './notification.component';
import { provideI18nTesting } from '../../../i18n/mock-i18n';

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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideI18nTesting()]
    });
    tester = new NotificationComponentTester();
    notificationService = TestBed.inject(NotificationService);
    await tester.change();
  });

  it('should not display initially', () => {
    expect(tester.toasts.length).toBe(0);
  });

  it('should display an i18ned success message and hide it after some seconds', fakeAsync(async () => {
    notificationService.success('common.save');
    await tester.change();
    tick(2500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-success');
    expect(tester.toasts[0]).toContainText('Save');

    notificationService.success('common.cancel');
    await tester.change();
    expect(tester.toasts.length).toBe(2);

    tick(3000);
    await tester.change();
    expect(tester.toasts.length).toBe(1);

    tick(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  }));

  it('should display an i18ned error message and hide it after some seconds', fakeAsync(async () => {
    notificationService.error('common.save');
    await tester.change();
    tick(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-danger');
    expect(tester.toasts[0]).toContainText('Save');
    tick(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  }));

  it('should display a non-i18ned error message and hide it after some seconds', fakeAsync(async () => {
    notificationService.errorMessage('common.save');
    await tester.change();
    tick(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-danger');
    expect(tester.toasts[0]).toContainText('common.save');
    tick(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  }));

  it('should display a success message with parameters', fakeAsync(async () => {
    notificationService.success('engine.updated');
    await tester.change();
    tick(500);
    expect(tester.toasts.length).toBe(1);
    expect(tester.toasts[0]).toHaveClass('bg-success');
    expect(tester.toasts[0]).toContainText('Engine settings updated');
    tick(5000);
    await tester.change();
    expect(tester.toasts.length).toBe(0);
  }));
});
