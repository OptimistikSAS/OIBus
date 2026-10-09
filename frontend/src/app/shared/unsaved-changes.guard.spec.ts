import { TestBed } from '@angular/core/testing';

import { firstValueFrom, of } from 'rxjs';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { CanComponentDeactivate, UnsavedChangesGuard } from './unsaved-changes.guard';

describe('UnsavedChangesGuard', () => {
  let guard: UnsavedChangesGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(UnsavedChangesGuard);
  });

  test.each([
    { name: 'without', component: {} },
    { name: 'with an undefined', component: { canDeactivate: undefined } }
  ])('should allow to leave a component $name canDeactivate method', ({ component }) => {
    expect(guard.canDeactivate(component)).toBe(true);
  });

  test.each([true, false])('should return the boolean returned by the component (%s)', value => {
    const component: CanComponentDeactivate = { canDeactivate: vi.fn().mockReturnValue(value) };

    expect(guard.canDeactivate(component)).toBe(value);
    expect(component.canDeactivate).toHaveBeenCalled();
  });

  test.each([true, false])('should return the observable returned by the component (%s)', async value => {
    const component: CanComponentDeactivate = { canDeactivate: () => of(value) };

    const result = guard.canDeactivate(component);

    await expect(typeof result === 'boolean' ? result : firstValueFrom(result)).resolves.toBe(value);
  });
});
