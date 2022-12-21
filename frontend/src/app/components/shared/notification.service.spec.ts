import { TestBed } from '@angular/core/testing';
import { Notification, NotificationService } from './notification.service';

describe('NotificationService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should emit every time a success is called', () => {
    const service: NotificationService = TestBed.inject(NotificationService);
    let notification: Notification | null = null;
    service.notificationChanges.subscribe(m => (notification = m));
    service.success('hello');
    expect(notification!.message).toBeUndefined();
    expect(notification!.i18nKey).toBe('hello');
    expect(notification!.i18nArgs).toBeUndefined();
    expect(notification!.type).toBe('success');
    service.success('world', { value: '!' });
    expect(notification!.message).toBeUndefined();
    expect(notification!.i18nKey).toBe('world');
    expect(notification!.i18nArgs).toEqual({ value: '!' });
    expect(notification!.type).toBe('success');
  });

  it('should emit every time an error is called', () => {
    const service: NotificationService = TestBed.inject(NotificationService);
    let notification: Notification | null = null;
    service.notificationChanges.subscribe(m => (notification = m));
    service.error('hello');
    expect(notification!.message).toBeUndefined();
    expect(notification!.i18nKey).toBe('hello');
    expect(notification!.i18nArgs).toBeUndefined();
    expect(notification!.type).toBe('error');
    service.error('world', { value: '!' });
    expect(notification!.message).toBeUndefined();
    expect(notification!.i18nKey).toBe('world');
    expect(notification!.i18nArgs).toEqual({ value: '!' });
    expect(notification!.type).toBe('error');
  });

  it('should emit every time an error message is called', () => {
    const service: NotificationService = TestBed.inject(NotificationService);
    let notification: Notification | null = null;
    service.notificationChanges.subscribe(m => (notification = m));
    service.errorMessage('hello');
    expect(notification!.message).toBe('hello');
    expect(notification!.i18nKey).toBeUndefined();
  });
});
