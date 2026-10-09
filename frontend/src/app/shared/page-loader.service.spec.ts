import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';

import { Subject } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { createMock, MockObject } from '../../test/vitest-create-mock';
import { PageLoader } from './page-loader.service';
import { toPage } from './utils/page.utils';

describe('PageLoader', () => {
  test('should emit when the router navigates and when the current page is reloaded', () => {
    const router: MockObject<Router> = createMock(Router);
    const queryParamMap$ = new Subject<ParamMap>();

    router.navigate.mockImplementation(() => {
      queryParamMap$.next(convertToParamMap({ page: '1' }));
      return Promise.resolve(true);
    });

    const route: Partial<ActivatedRoute> = { queryParamMap: queryParamMap$.asObservable() };

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }, { provide: ActivatedRoute, useValue: route }, PageLoader]
    });

    const pageLoader = TestBed.inject(PageLoader);
    const actualPages: Array<number> = [];
    pageLoader.pageLoads$.subscribe(newPage => actualPages.push(newPage));

    const page = toPage(['a'], 40, 0, 20);

    pageLoader.loadPage(page);
    expect(router.navigate.mock.calls.length).toBe(0);
    expect(actualPages).toEqual([0]);

    pageLoader.loadPage(page, 1);
    expect(router.navigate).toHaveBeenCalledWith(['.'], {
      relativeTo: route,
      queryParams: { page: 1 },
      queryParamsHandling: 'merge'
    });
    expect(actualPages).toEqual([0, 1]);

    pageLoader.loadPage({ ...page, number: 1 });
    expect(router.navigate.mock.calls.length).toBe(1);
    expect(actualPages).toEqual([0, 1, 1]);
  });
});
