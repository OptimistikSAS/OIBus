import { inject, Service } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

import { defer, distinctUntilChanged, map, merge, Observable, Subject } from 'rxjs';

import { Page } from '@oibus/shared/common/types';

/**
 * Service used to load a page when the `page` query param changes, or when we need to reload the current
 * page, for example after a deletion, in which case navigating doesn't refresh the query param.
 *
 * This service is designed to be provided at the component level.
 */
@Service()
export class PageLoader {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly pageLoadsSubject = new Subject<number>();
  private pageParam = 'page';
  private watchedParams: ReadonlyArray<string> | null = null;

  /**
   * The observable which emits whenever the page changes, either because a real navigation has been triggered,
   * or because a request to reload the current page has been made.
   */
  readonly pageLoads$: Observable<number> = defer(() => {
    const pageQueryParam$ = this.route.queryParamMap.pipe(
      // other components of the page may keep their state in the URL too: their changes do not load the page again
      distinctUntilChanged((previous, current) => this.watchedParamsKey(previous) === this.watchedParamsKey(current)),
      map(paramMap => +(paramMap.get(this.pageParam) || 0))
    );
    return merge(pageQueryParam$, this.pageLoadsSubject);
  });

  /**
   * Configures the query params of the page, before subscribing to pageLoads$, when it is not the only component of the
   * page keeping its state in the URL.
   * @param pageParam the query param of the page number
   * @param watchedParams the query params which load the page again when one of them changes (by default, all of them)
   */
  configure(pageParam: string, watchedParams: ReadonlyArray<string> | null) {
    this.pageParam = pageParam;
    this.watchedParams = watchedParams;
  }

  private watchedParamsKey(paramMap: ParamMap): string {
    const names = this.watchedParams ?? paramMap.keys;
    return JSON.stringify(names.map(name => [name, paramMap.getAll(name)]));
  }

  /**
   * Requests to load the given page number. If the given page number is equal to the number of the given page,
   * then this page needs to be reloaded and the URL doesn't change. Otherwise, an actual navigation is done
   * using the router, by merging the new page number with the current query parameters.
   */
  loadPage(page: Page<unknown>, pageNumber: number = page.number) {
    if (pageNumber === page.number) {
      this.pageLoadsSubject.next(pageNumber);
    } else {
      this.router.navigate(['.'], {
        queryParams: { [this.pageParam]: pageNumber },
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    }
  }
}
