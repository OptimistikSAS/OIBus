import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { describe, expect, test, vi } from 'vitest';

import {
  booleanListParam,
  listParam,
  nextSort,
  optionalParam,
  pageParam,
  paramValue,
  sortParam,
  textParam,
  toggled,
  UrlState
} from './url-state';

describe('url-state', () => {
  describe('query params', () => {
    test('should read and write a text', () => {
      const param = textParam('name');
      expect(param.parse(['south'])).toBe('south');
      expect(param.parse([])).toBe('');
      expect(param.format('south')).toBe('south');
      expect(param.format('')).toBeNull();
    });

    test('should read and write an optional value, among the allowed ones', () => {
      const param = optionalParam('status', ['enabled', 'disabled']);
      expect(param.parse(['enabled'])).toBe('enabled');
      expect(param.parse(['unknown'])).toBeNull();
      expect(param.parse([])).toBeNull();
      expect(param.format(null)).toBeNull();
      expect(optionalParam('group').parse(['any'])).toBe('any');
    });

    test('should read and write a list of the allowed values', () => {
      const param = listParam('type', ['mqtt', 'opcua', 'modbus']);
      expect(param.parse(['opcua', 'unknown', 'mqtt'])).toEqual(['mqtt', 'opcua']);
      expect(param.format(['opcua'])).toEqual(['opcua']);
      expect(param.format([])).toBeNull();
    });

    test('should read and write a list of booleans', () => {
      const param = booleanListParam('status');
      expect(param.parse(['true', 'maybe'])).toEqual([true]);
      expect(param.format([false, true])).toEqual(['false', 'true']);
      expect(param.format([])).toBeNull();
    });

    test('should read and write a page number', () => {
      const param = pageParam('page');
      expect(param.parse(['2'])).toBe(2);
      expect(param.parse(['-1'])).toBe(0);
      expect(param.parse(['two'])).toBe(0);
      expect(param.format(2)).toBe('2');
      expect(param.format(0)).toBeNull();
    });

    test('should read and write a sort, the default one being left out of the URL', () => {
      const param = sortParam('sort', ['name', 'type'], { field: 'name', direction: 'asc' });
      expect(param.parse(['type:desc'])).toEqual({ field: 'type', direction: 'desc' });
      expect(param.parse(['description:desc'])).toEqual({ field: 'name', direction: 'asc' });
      expect(param.parse(['type:sideways'])).toEqual({ field: 'name', direction: 'asc' });
      expect(param.format({ field: 'type', direction: 'asc' })).toBe('type:asc');
      expect(param.format({ field: 'name', direction: 'asc' })).toBeNull();
    });

    test('should give the next sort and toggle a value', () => {
      expect(nextSort({ field: 'name', direction: 'asc' }, 'name')).toEqual({ field: 'name', direction: 'desc' });
      expect(nextSort({ field: 'name', direction: 'desc' }, 'type')).toEqual({ field: 'type', direction: 'asc' });
      expect(toggled(['a', 'b'], 'a')).toEqual(['b']);
      expect(toggled(['b'], 'a')).toEqual(['b', 'a']);
    });
  });

  describe('UrlState', () => {
    test('should merge the changes of a task into a single navigation replacing the URL', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]), UrlState] });
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/?other=kept&page=2');
      const navigate = vi.spyOn(router, 'navigate');
      const urlState = TestBed.inject(UrlState);
      const name = urlState.get(textParam('name'));

      urlState.patch(paramValue(textParam('name'), 'south'));
      urlState.patch(paramValue(pageParam('page'), 0));

      await vi.waitFor(() => expect(router.parseUrl(router.url).queryParams).toEqual({ other: 'kept', name: 'south' }));
      expect(navigate).toHaveBeenCalledOnce();
      expect(navigate.mock.lastCall![1]).toEqual(expect.objectContaining({ replaceUrl: true, queryParamsHandling: 'merge' }));
      expect(name()).toBe('south');
    });
  });
});
