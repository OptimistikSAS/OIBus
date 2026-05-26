import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PortRedirectModalComponent } from './port-redirect-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WindowService } from '../window.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

describe('PortRedirectModalComponent', () => {
  let component: PortRedirectModalComponent;
  let fixture: ComponentFixture<PortRedirectModalComponent>;
  let windowService: MockObject<WindowService>;

  beforeEach(async () => {
    windowService = createMock(WindowService);

    await TestBed.configureTestingModule({
      imports: [PortRedirectModalComponent],
      providers: [NgbActiveModal, { provide: WindowService, useValue: windowService }, provideI18nTesting()]
    }).compileComponents();

    fixture = TestBed.createComponent(PortRedirectModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    if (component) {
      component.ngOnDestroy();
    }
  });

  test('should create', () => {
    expect(component).toBeTruthy();
  });

  test('should initialize with the new port', () => {
    component.initialize(3333);
    expect(component.newPort()).toBe(3333);
  });

  test('should start countdown on init', () => {
    component.initialize(3333);
    component.ngOnInit();
    expect(component.secondsRemaining()).toBe(30);
    expect(component.progress()).toBe(1);
  });

  test('should redirect when countdown reaches zero', () => {
    vi.useFakeTimers();

    component.initialize(3333);
    component.ngOnInit();

    vi.advanceTimersByTime(30000);

    expect(windowService.redirectTo).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('should redirect immediately when redirect button is clicked', () => {
    component.initialize(3333);
    component.redirect();
    expect(windowService.redirectTo).toHaveBeenCalled();
  });

  test('should construct correct redirect URL', () => {
    component.initialize(3333);
    component.redirect();
    const calls = windowService.redirectTo.mock.calls;
    const redirectUrl = calls[calls.length - 1][0];
    expect(redirectUrl).toContain(':3333');
  });
});
