import { inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { OIBUS_FORM_MODE } from './oibus-form-mode.token';

describe('OIBUS_FORM_MODE token', () => {
  it('should default to create mode', () => {
    const getMode = TestBed.runInInjectionContext(() => inject(OIBUS_FORM_MODE));
    expect(getMode()).toBe('create');
  });

  it('should allow overriding the mode provider', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: OIBUS_FORM_MODE, useValue: () => 'edit' }]
    });

    const getMode = TestBed.runInInjectionContext(() => inject(OIBUS_FORM_MODE, { optional: false }));
    expect(getMode()).toBe('edit');
  });
});
