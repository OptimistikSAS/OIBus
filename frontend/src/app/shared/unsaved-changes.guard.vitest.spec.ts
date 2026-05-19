import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { UnsavedChangesGuard, CanComponentDeactivate } from './unsaved-changes.guard';

describe('UnsavedChangesGuard', () => {
  let guard: UnsavedChangesGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [UnsavedChangesGuard] });
    guard = TestBed.inject(UnsavedChangesGuard);
  });

  test('should be created', () => {
    expect(guard).toBeTruthy();
  });

  test('should return true when component has no canDeactivate method', () => {
    const component = {} as CanComponentDeactivate;
    expect(guard.canDeactivate(component)).toBe(true);
  });

  test('should return true when component canDeactivate returns true', () => {
    const component: CanComponentDeactivate = { canDeactivate: vi.fn().mockReturnValue(true) };
    expect(guard.canDeactivate(component)).toBe(true);
    expect(component.canDeactivate).toHaveBeenCalled();
  });

  test('should return false when component canDeactivate returns false', () => {
    const component: CanComponentDeactivate = { canDeactivate: vi.fn().mockReturnValue(false) };
    expect(guard.canDeactivate(component)).toBe(false);
    expect(component.canDeactivate).toHaveBeenCalled();
  });

  test('should return Observable<true> when component canDeactivate returns Observable<true>', () => {
    const component: CanComponentDeactivate = { canDeactivate: vi.fn().mockReturnValue(of(true)) };
    const result = guard.canDeactivate(component);
    expect(result).toBeInstanceOf(Observable);
    expect(component.canDeactivate).toHaveBeenCalled();

    let observableResult: boolean | undefined;
    (result as Observable<boolean>).subscribe(value => (observableResult = value));
    expect(observableResult).toBe(true);
  });

  test('should return Observable<false> when component canDeactivate returns Observable<false>', () => {
    const component: CanComponentDeactivate = { canDeactivate: vi.fn().mockReturnValue(of(false)) };
    const result = guard.canDeactivate(component);
    expect(result).toBeInstanceOf(Observable);
    expect(component.canDeactivate).toHaveBeenCalled();

    let observableResult: boolean | undefined;
    (result as Observable<boolean>).subscribe(value => (observableResult = value));
    expect(observableResult).toBe(false);
  });

  test('should handle component with undefined canDeactivate method', () => {
    const component = { canDeactivate: undefined } as unknown as CanComponentDeactivate;
    expect(guard.canDeactivate(component)).toBe(true);
  });

  test('should handle component with null canDeactivate method', () => {
    const component = { canDeactivate: null } as unknown as CanComponentDeactivate;
    expect(guard.canDeactivate(component)).toBe(true);
  });
});
