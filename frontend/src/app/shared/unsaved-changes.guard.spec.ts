import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { UnsavedChangesGuard, CanComponentDeactivate } from './unsaved-changes.guard';

describe('UnsavedChangesGuard', () => {
  let guard: UnsavedChangesGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UnsavedChangesGuard]
    });
    guard = TestBed.inject(UnsavedChangesGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('should return true when component has no canDeactivate method', () => {
    const component = {} as CanComponentDeactivate;

    const result = guard.canDeactivate(component);

    expect(result).toBe(true);
  });

  it('should return true when component canDeactivate returns true', () => {
    const component: CanComponentDeactivate = {
      canDeactivate: jasmine.createSpy('canDeactivate').and.returnValue(true)
    };

    const result = guard.canDeactivate(component);

    expect(result).toBe(true);
    expect(component.canDeactivate).toHaveBeenCalled();
  });

  it('should return false when component canDeactivate returns false', () => {
    const component: CanComponentDeactivate = {
      canDeactivate: jasmine.createSpy('canDeactivate').and.returnValue(false)
    };

    const result = guard.canDeactivate(component);

    expect(result).toBe(false);
    expect(component.canDeactivate).toHaveBeenCalled();
  });

  it('should return Observable<true> when component canDeactivate returns Observable<true>', () => {
    const component: CanComponentDeactivate = {
      canDeactivate: jasmine.createSpy('canDeactivate').and.returnValue(of(true))
    };

    const result = guard.canDeactivate(component);

    expect(result).toBeInstanceOf(Observable);
    expect(component.canDeactivate).toHaveBeenCalled();

    // Test the observable value
    let observableResult: boolean | undefined;
    (result as Observable<boolean>).subscribe(value => {
      observableResult = value;
    });
    expect(observableResult).toBe(true);
  });

  it('should return Observable<false> when component canDeactivate returns Observable<false>', () => {
    const component: CanComponentDeactivate = {
      canDeactivate: jasmine.createSpy('canDeactivate').and.returnValue(of(false))
    };

    const result = guard.canDeactivate(component);

    expect(result).toBeInstanceOf(Observable);
    expect(component.canDeactivate).toHaveBeenCalled();

    // Test the observable value
    let observableResult: boolean | undefined;
    (result as Observable<boolean>).subscribe(value => {
      observableResult = value;
    });
    expect(observableResult).toBe(false);
  });

  it('should handle component with undefined canDeactivate method', () => {
    const component = { canDeactivate: undefined } as unknown as CanComponentDeactivate;

    const result = guard.canDeactivate(component);

    expect(result).toBe(true);
  });

  it('should handle component with null canDeactivate method', () => {
    const component = { canDeactivate: null } as any as CanComponentDeactivate;

    const result = guard.canDeactivate(component);

    expect(result).toBe(true);
  });
});
