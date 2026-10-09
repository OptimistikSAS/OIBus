import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { WindowService } from './window.service';

describe('WindowService', () => {
  let service: WindowService;
  let initialHistoryState: unknown;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WindowService);
    initialHistoryState = window.history.state;
  });

  afterEach(() => {
    window.localStorage.removeItem('randomKey');
    window.history.replaceState(initialHistoryState, '');
  });

  test('should set, get and remove item from local storage', () => {
    service.setStorageItem('randomKey', 'randomValue');
    expect(window.localStorage.getItem('randomKey')).toBe('randomValue');
    expect(service.getStorageItem('randomKey')).toBe('randomValue');

    service.removeStorageItem('randomKey');
    expect(service.getStorageItem('randomKey')).toBeNull();
  });

  test('should get history state key', () => {
    window.history.replaceState({ randomKey: 'randomValue' }, '');

    expect(service.getHistoryState<string>('randomKey')).toBe('randomValue');
    expect(service.getHistoryState<string>('unknown')).toBeNull();
  });

  test('should get history state', () => {
    const state = { foo: 'bar' };
    window.history.replaceState(state, '');

    expect(service.getHistoryState()).toEqual(state);
  });
});
