import { ActivatedRoute, convertToParamMap, Params, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { PageLoader } from './page-loader.service';
import { createMock } from 'ngx-speculoos';
import { Page } from './types';

describe('PageLoader', () => {
  it('should emit when the router navigates and when the current page is reloaded', () => {
    const queryParamMap$ = new Subject<Params>();
    const router = createMock(Router);

    // a fake router that navigates to the page 1 when asked to navigate
    router.navigate.and.callFake(() => {
      queryParamMap$.next(convertToParamMap({ page: '1' }));
      return Promise.resolve(true);
    });

    const route = {
      queryParamMap: queryParamMap$.asObservable()
    } as ActivatedRoute;

    const pageLoader = new PageLoader(route, router);

    const actualPages: Array<number> = [];
    pageLoader.pageLoads$.subscribe(newPage => actualPages.push(newPage));

    const page = {
      number: 0
    } as Page<any>;

    // reload the current page
    pageLoader.loadPage(page);
    // we should not navigate
    expect(router.navigate.calls.count()).toBe(0);
    expect(actualPages).toEqual([0]);

    // load another page
    pageLoader.loadPage(page, 1);
    // we should navigate
    expect(router.navigate).toHaveBeenCalledWith(['.'], { relativeTo: route, queryParams: { page: 1 }, queryParamsHandling: 'merge' });
    expect(actualPages).toEqual([0, 1]);

    // reload the current page
    page.number = 1;
    pageLoader.loadPage(page);
    // we should not navigate
    expect(router.navigate.calls.count()).toBe(1);
    expect(actualPages).toEqual([0, 1, 1]);
  });
});
