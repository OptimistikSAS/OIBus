import { computed, DestroyRef, effect, inject, Service, Signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';

import { debounce, Observable, timer } from 'rxjs';

/** The value of a query param once formatted: null removes it from the URL */
export type QueryParamValue = string | Array<string> | null;

/**
 * A state of the page (search, filter, sort, page number) kept in a query param of its URL, so that the page shows the
 * same thing when it is reloaded, when the browser goes back to it, or when its link is shared.
 */
export interface QueryParam<T> {
  readonly name: string;
  /** Reads the value from the values of the query param, ignoring the invalid ones (e.g. from an outdated link) */
  parse(values: ReadonlyArray<string>): T;
  /** The value of the query param, or null when the value is the default one, to keep the URL short */
  format(value: T): QueryParamValue;
}

/** A text, such as a searched name. The default is the empty string. */
export function textParam(name: string): QueryParam<string> {
  return {
    name,
    parse: values => values[0] ?? '',
    format: value => value || null
  };
}

/** An optional single value, such as the id of a selected group. Only the given values are accepted when given. */
export function optionalParam<const T extends string = string>(name: string, allowed?: ReadonlyArray<T>): QueryParam<T | null> {
  return {
    name,
    parse: values => {
      const value = values[0];
      return value && (!allowed || allowed.includes(value as T)) ? (value as T) : null;
    },
    format: value => value
  };
}

/** The query param of the item shown in a modal on the page of a south connector or of a history query */
export const ITEM_LINK_PARAM = optionalParam('item');

/** A list of values, such as the statuses a list is filtered on. Only the given values are accepted. */
export function listParam<T extends string>(name: string, allowed: ReadonlyArray<T>): QueryParam<Array<T>> {
  return {
    name,
    parse: values => allowed.filter(value => values.includes(value)),
    format: value => (value.length ? [...value] : null)
  };
}

/** A list of booleans, such as the enabled/disabled filter of the connectors */
export function booleanListParam(name: string): QueryParam<Array<boolean>> {
  return {
    name,
    parse: values => [false, true].filter(value => values.includes(String(value))),
    format: value => (value.length ? value.map(String) : null)
  };
}

/** A 0-based page number. The default is the first page. */
export function pageParam(name: string): QueryParam<number> {
  return {
    name,
    parse: values => {
      const page = Number.parseInt(values[0] ?? '', 10);
      return Number.isInteger(page) && page > 0 ? page : 0;
    },
    format: value => (value > 0 ? String(value) : null)
  };
}

export type SortDirection = 'asc' | 'desc';
export interface Sort<F extends string> {
  field: F;
  direction: SortDirection;
}

/** A sort, written `field:direction` (e.g. `name:asc`). Only the given fields are accepted. */
export function sortParam<F extends string>(name: string, fields: ReadonlyArray<F>, defaultSort: Sort<F>): QueryParam<Sort<F>> {
  return {
    name,
    parse: values => {
      const [field, direction] = (values[0] ?? '').split(':');
      if (fields.includes(field as F) && (direction === 'asc' || direction === 'desc')) {
        return { field: field as F, direction };
      }
      return defaultSort;
    },
    format: value =>
      value.field === defaultSort.field && value.direction === defaultSort.direction ? null : `${value.field}:${value.direction}`
  };
}

/** The sort of a column after a click on its header: the other direction when it is already sorted, ascending otherwise */
export function nextSort<F extends string>(sort: Sort<F>, field: F): Sort<F> {
  return sort.field === field ? { field, direction: sort.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' };
}

/** The values with the given one added, or removed when it is already there: for a filter chip clicked */
export function toggled<T>(values: ReadonlyArray<T>, value: T): Array<T> {
  return values.includes(value) ? values.filter(element => element !== value) : [...values, value];
}

/** The query params to give to UrlState.patch() to set the given value */
export function paramValue<T>(param: QueryParam<T>, value: T): Params {
  return { [param.name]: param.format(value) };
}

/**
 * The query params changed in the current task, not yet navigated to. Shared by all the instances of UrlState, since
 * several components of a page can keep their state in its URL (e.g. the item table and the page that adds filters to
 * it): two navigations started in the same task would each merge their changes into the same URL, and the last one
 * would undo the changes of the first.
 */
let pendingChanges: Params | null = null;

/**
 * The query params of the page, read as signals and changed by navigating.
 *
 * The changes made in the same task are merged into a single navigation, which replaces the current URL in the browser
 * history: a search does not add history entries, so that going back leaves the page.
 *
 * This service is designed to be provided at the component level.
 */
@Service()
export class UrlState {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /**
   * True once the component is destroyed, i.e. its page left: the URL is not changed anymore, since it is the URL of
   * another page (e.g. when a modal opened by the page is closed after going back to the previous page)
   */
  private destroyed = false;
  /** The ids of the elements shown in the URL by showInUrl(), by query param, for openLinked() not to open them again */
  private readonly shownIds = new Map<string, string>();

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  private readonly paramMap: Signal<ParamMap> = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap
  });

  /** The value of the given query param, updated when the URL changes */
  get<T>(param: QueryParam<T>): Signal<T> {
    return computed(() => this.value(param));
  }

  /** The value of the given query param in the current URL; read in a reactive context, it is tracked as a signal */
  value<T>(param: QueryParam<T>): T {
    return param.parse(this.paramMap().getAll(param.name));
  }

  /**
   * Keeps a form control and a query param in sync: a change of the control changes the URL (after the given debounce
   * time, for a text typed in), and a change of the URL (e.g. a link followed) changes the control.
   * Must be called in an injection context.
   * @param param the query param, or a function returning it (null when the control is not kept in the URL)
   * @param otherChanges the other query params to set when the control changes, e.g. to go back to the first page
   */
  syncControl<T>(
    param: QueryParam<T> | (() => QueryParam<T> | null),
    control: AbstractControl<T>,
    options: { debounce?: number; otherChanges?: () => Params } = {}
  ) {
    const getParam = typeof param === 'function' ? param : () => param;
    // the last value of the control written to the URL, or read from it: a URL change that does not differ from it comes
    // from the control itself (possibly typed in further since), so the control is left as it is
    let synced: string | null = null;
    effect(() => {
      const current = getParam();
      if (!current) return;
      const value = this.value(current);
      const formatted = JSON.stringify(current.format(value));
      if (formatted !== synced) {
        synced = formatted;
        untracked(() => control.setValue(value, { emitEvent: false }));
      }
    });
    control.valueChanges
      .pipe(
        debounce(() => timer(options.debounce ?? 0)),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe(value => {
        const current = getParam();
        if (!current) return;
        const formatted = current.format(value);
        if (JSON.stringify(formatted) === synced) return;
        synced = JSON.stringify(formatted);
        this.patch({ [current.name]: formatted, ...options.otherChanges?.() });
      });
  }

  /**
   * Keeps the id of the element a modal shows in the given query param while the modal is open, so that the link of the
   * page shows the element again (see openLinked())
   */
  showInUrl(param: QueryParam<string | null>, id: string, modalResult: Observable<unknown>) {
    this.shownIds.set(param.name, id);
    this.patch(paramValue(param, id));
    const remove = () => {
      // another element may be shown since (e.g. a view modal followed by the edit modal of the same element)
      if (this.shownIds.get(param.name) === id) {
        this.shownIds.delete(param.name);
        this.patch(paramValue(param, null));
      }
    };
    modalResult.subscribe({ complete: remove, error: remove });
  }

  /**
   * Opens the element whose id is in the given query param, once the elements are loaded: when a link to the element
   * is followed (see showInUrl()), when the page is displayed or while it is (the component of a page is reused when
   * only its URL changes). An element not found (e.g. deleted since) is removed from the URL.
   * Must be called in an injection context.
   * @param elements the elements, null while they are loaded (or while the ones of another entity are still displayed)
   */
  openLinked<E extends { id: string }>(param: QueryParam<string | null>, elements: () => ReadonlyArray<E> | null, open: (element: E) => void) {
    effect(() => {
      const id = this.value(param);
      if (!id || this.shownIds.get(param.name) === id) return;
      const loaded = elements();
      if (!loaded) return;
      const element = loaded.find(candidate => candidate.id === id);
      untracked(() => {
        if (element) {
          open(element);
          // in case the element is opened without showInUrl(), not to open it again
          this.shownIds.set(param.name, id);
        } else {
          this.patch(paramValue(param, null));
        }
      });
    });
  }

  /** Sets the given query params (see paramValue()), keeping the others */
  patch(queryParams: Params) {
    if (this.destroyed) return;
    if (pendingChanges) {
      Object.assign(pendingChanges, queryParams);
      return;
    }
    const changes = { ...queryParams };
    pendingChanges = changes;
    queueMicrotask(() => {
      pendingChanges = null;
      if (this.destroyed) return;
      this.router.navigate([], { relativeTo: this.route, queryParams: changes, queryParamsHandling: 'merge', replaceUrl: true });
    });
  }
}

