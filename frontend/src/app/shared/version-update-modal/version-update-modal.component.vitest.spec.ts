import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VersionUpdateModalComponent } from './version-update-modal.component';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { WindowService } from '../window.service';
import { provideI18nTesting } from '../../../i18n/mock-i18n';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createMock, MockObject } from '../../../test/vitest-create-mock';

describe('VersionUpdateModalComponent', () => {
  let component: VersionUpdateModalComponent;
  let fixture: ComponentFixture<VersionUpdateModalComponent>;
  let activeModal: MockObject<NgbActiveModal>;
  let windowService: MockObject<WindowService>;

  beforeEach(async () => {
    activeModal = createMock(NgbActiveModal);
    windowService = createMock(WindowService);

    await TestBed.configureTestingModule({
      imports: [VersionUpdateModalComponent],
      providers: [
        provideI18nTesting(),
        { provide: NgbActiveModal, useValue: activeModal },
        { provide: WindowService, useValue: windowService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VersionUpdateModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  test('should create', () => {
    expect(component).toBeTruthy();
  });

  test('should initialize with 60 seconds', () => {
    fixture.detectChanges();
    expect(component.remainingSeconds()).toBe(60);
    expect(component.progress()).toBe(1);
  });

  test('should count down over time', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    vi.advanceTimersByTime(1000);
    expect(component.remainingSeconds()).toBeLessThan(60);
    expect(component.progress()).toBeLessThan(1);
    expect(component.progress()).toBeGreaterThan(0);
  });

  test('should reload when countdown reaches zero', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    vi.advanceTimersByTime(60000);
    vi.advanceTimersByTime(100);

    expect(activeModal.close).toHaveBeenCalled();
    expect(windowService.reload).toHaveBeenCalled();
  });

  test('should reload immediately when reload button is clicked', () => {
    fixture.detectChanges();

    component.reload();

    expect(activeModal.close).toHaveBeenCalled();
    expect(windowService.reload).toHaveBeenCalled();
  });

  test('should clear interval on destroy', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    fixture.destroy();

    vi.advanceTimersByTime(5000);

    expect(component).toBeTruthy();
  });

  test('should update progress proportionally', () => {
    vi.useFakeTimers();
    fixture.detectChanges();

    vi.advanceTimersByTime(30000);

    const progress = component.progress();
    expect(progress).toBeGreaterThan(0.45);
    expect(progress).toBeLessThan(0.55);
  });

  test('should display translated title', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.modal-title');

    expect(title).toBeTruthy();
  });

  test('should display reload button', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('#reload-button');

    expect(button).toBeTruthy();
  });
});
