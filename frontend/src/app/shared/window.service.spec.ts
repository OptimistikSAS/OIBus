import { TestBed } from '@angular/core/testing';

import { WindowService } from './window.service';

describe('WindowService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should get and remove item from local storage', () => {
    const service: WindowService = TestBed.inject(WindowService);
    window.localStorage.setItem('randomKey', 'randomValue');
    expect(service.getStorageItem('randomKey')).toBe('randomValue');
    service.removeStorageItem('randomKey');
    expect(service.getStorageItem('randomKey')).toBeNull();
  });

  it('should get history state key', () => {
    const service: WindowService = TestBed.inject(WindowService);
    window.history.pushState({}, 'title'); // init state
    window.history.state.randomKey = 'randomValue';
    expect(service.getHistoryState<string>('randomKey')).toBe('randomValue');
    expect(service.getHistoryState<string>('unknown')).toBeNull();
  });

  it('should get history state', () => {
    const service: WindowService = TestBed.inject(WindowService);
    const state = { foo: 'bar' };
    window.history.pushState(state, 'title'); // init state
    expect(service.getHistoryState()).toEqual(state);
  });
});
