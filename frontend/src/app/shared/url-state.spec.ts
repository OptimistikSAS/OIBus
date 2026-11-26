import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { Subject } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import {
  booleanListParam,
  ITEM_LINK_PARAM,
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

    test('should not change the URL once its component is destroyed', async () => {
      const { fixture, router } = await createHost('/?other=kept');
      const urlState = fixture.componentInstance.urlState;

      fixture.destroy();
      urlState.patch({ name: 'south' });

      await new Promise(resolve => setTimeout(resolve));
      expect(router.url).toBe('/?other=kept');
    });

    test('should keep an element shown in the URL while its modal is open, until its page is left', async () => {
      const { fixture, router } = await createHost('/?other=kept');
      const urlState = fixture.componentInstance.urlState;
      const modalResult = new Subject<void>();

      urlState.showInUrl(ITEM_LINK_PARAM, 'item1', modalResult);
      await vi.waitFor(() => expect(router.url).toBe('/?other=kept&item=item1'));

      // the page is left while the modal is open: closing it does not change the URL of the other page
      await router.navigateByUrl('/?page=other');
      fixture.destroy();
      modalResult.complete();

      await new Promise(resolve => setTimeout(resolve));
      expect(router.url).toBe('/?page=other');
    });

    test('should open the element of the URL once loaded, and the ones linked while the page is displayed', async () => {
      const { fixture, router } = await createHost('/?item=item1');
      const host = fixture.componentInstance;
      fixture.detectChanges();
      expect(host.opened).toEqual([]);

      host.elements.set([{ id: 'item1' }, { id: 'item2' }]);
      await vi.waitFor(() => expect(host.opened).toEqual(['item1']));

      // the element is shown by its modal (see showInUrl()), and not opened again
      host.urlState.showInUrl(ITEM_LINK_PARAM, 'item1', new Subject());
      await new Promise(resolve => setTimeout(resolve));
      expect(host.opened).toEqual(['item1']);
      await router.navigateByUrl('/?item=item2');
      await vi.waitFor(() => expect(host.opened).toEqual(['item1', 'item2']));

      await router.navigateByUrl('/?item=unknown&other=kept');
      await vi.waitFor(() => expect(router.url).toBe('/?other=kept'));
      expect(host.opened).toEqual(['item1', 'item2']);
    });
  });
});

@Component({
  template: '',
  providers: [UrlState],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class UrlStateHostComponent {
  readonly urlState = inject(UrlState);
  readonly elements = signal<Array<{ id: string }> | null>(null);
  readonly opened: Array<string> = [];

  constructor() {
    this.urlState.openLinked(ITEM_LINK_PARAM, () => this.elements(), element => this.opened.push(element.id));
  }
}

async function createHost(url: string) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  return { fixture: TestBed.createComponent(UrlStateHostComponent), router };
}
