import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { PaginationComponent } from './pagination.component';
import { NgbPagination, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { Component } from '@angular/core';
import { ComponentTester, createMock, stubRoute } from 'ngx-speculoos';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { emptyPage, toPage } from '../test-utils';
import { Page } from '../types';

@Component({
  template: `<oib-pagination [page]="page" (pageChanged)="pageChanged($event)" [navigate]="navigate"></oib-pagination>`,
  standalone: true,
  imports: [PaginationComponent]
})
class TestComponent {
  page: Page<string> | null = null;
  newPage: number | null = null;

  navigate = false;

  pageChanged(newPage: number) {
    this.newPage = newPage;
  }
}

class TestComponentTester extends ComponentTester<TestComponent> {
  constructor() {
    super(TestComponent);
  }

  get ngbPagination(): NgbPagination {
    return this.component(NgbPagination)!;
  }

  get firstPageLink() {
    return this.element('a')!;
  }
}

describe('PaginationComponent', () => {
  let tester: TestComponentTester;

  describe('without routing', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [NgbPaginationModule, RouterTestingModule, PaginationComponent, TestComponent]
      });

      tester = new TestComponentTester();
    });

    it('should not display pagination if page is empty', () => {
      tester.componentInstance.page = emptyPage();

      tester.detectChanges();

      expect(tester.ngbPagination).toBeNull();
    });

    it('should not display pagination if page is alone', () => {
      tester.componentInstance.page = toPage(['a'], 1);

      tester.detectChanges();

      expect(tester.ngbPagination).toBeNull();
    });

    it('should emit event when page changes', fakeAsync(() => {
      tester.componentInstance.page = toPage(['a'], 21, 1, 20);

      tester.detectChanges();
      expect(tester.ngbPagination.page).toBe(2);

      tester.firstPageLink.click();
      tick();

      expect(tester.componentInstance.newPage).toBe(0);
    }));
  });

  describe('with routing', () => {
    let route: ActivatedRoute;
    let router: jasmine.SpyObj<Router>;

    beforeEach(() => {
      route = stubRoute();
      router = createMock(Router);

      TestBed.configureTestingModule({
        imports: [NgbPaginationModule, PaginationComponent, TestComponent],
        providers: [
          { provide: ActivatedRoute, useValue: route },
          { provide: Router, useValue: router }
        ]
      });

      tester = new TestComponentTester();
      tester.componentInstance.page = toPage(['a'], 21, 1, 20);
    });

    it('should not navigate if navigate is false', fakeAsync(() => {
      tester.detectChanges();

      tester.firstPageLink.click();
      tick();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(tester.componentInstance.newPage).toBe(0);
    }));

    it('should navigate if navigate is true', fakeAsync(() => {
      tester.componentInstance.navigate = true;

      tester.detectChanges();

      tester.firstPageLink.click();
      tick();

      expect(router.navigate).toHaveBeenCalledWith(['.'], { relativeTo: route, queryParams: { page: 0 }, queryParamsHandling: 'merge' });
      expect(tester.componentInstance.newPage).toBe(0);
    }));
  });
});
