import { ActivatedRoute, Router } from '@angular/router';
import { map, merge, Observable, Subject } from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { Page } from '../../../../backend/shared/model/types';

/**
 * Service used to load a page when the `page` query param changes, or when we need to reload the current
 * page, for example after a deletion, in which case navigating doesn't refresh the query param.
 *
 * This service is designed to be provided at the component level.
 */
@Injectable()
export class PageLoader {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private pageLoadsSubject = new Subject<number>();

  /**
   * The observable which emits whenever the page changes, either because a real navigation has been triggered,
   * or because a request to reload the current page has been made.
   */
  pageLoads$: Observable<number>;

  constructor() {
    const pageQueryParam$ = this.route.queryParamMap.pipe(map(paramMap => +(paramMap.get('page') || 0)));
    this.pageLoads$ = merge(pageQueryParam$, this.pageLoadsSubject);
  }

  /**
   * Requests to load the given page number. If the given page number is equal to the number of the given page,
   * then this page needs to be reloaded and the URL doesn't change. Otherwise, an actual navigation is done
   * using the router, by merging the new page number with the current query parameters.
   */
  loadPage(page: Page<any>, pageNumber: number = page.number) {
    if (pageNumber === page.number) {
      this.pageLoadsSubject.next(pageNumber);
    } else {
      this.router.navigate(['.'], {
        queryParams: { page: pageNumber },
        relativeTo: this.route,
        queryParamsHandling: 'merge'
      });
    }
  }
}
