import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Params, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, test } from 'vitest';
import { PageLoader } from './page-loader.service';
import { Page } from '../../../../backend/shared/model/types';
import { createMock, MockObject } from '../../test/vitest-create-mock';

describe('PageLoader', () => {
  test('should emit when the router navigates and when the current page is reloaded', () => {
    const router: MockObject<Router> = createMock(Router);
    const queryParamMap$ = new Subject<Params>();

    router.navigate.mockImplementation(() => {
      queryParamMap$.next(convertToParamMap({ page: '1' }));
      return Promise.resolve(true);
    });

    const route = { queryParamMap: queryParamMap$.asObservable() } as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }, { provide: ActivatedRoute, useValue: route }, PageLoader]
    });

    const pageLoader = TestBed.inject(PageLoader);
    const actualPages: Array<number> = [];
    pageLoader.pageLoads$.subscribe(newPage => actualPages.push(newPage));

    const page = { number: 0 } as Page<any>;

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

    page.number = 1;
    pageLoader.loadPage(page);
    expect(router.navigate.mock.calls.length).toBe(1);
    expect(actualPages).toEqual([0, 1, 1]);
  });
});
