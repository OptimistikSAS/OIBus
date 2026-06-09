import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { page } from 'vitest/browser';
import { beforeEach, describe, expect, test } from 'vitest';
import { Page } from '../../../../../backend/shared/model/types';
import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { emptyPage, toPage } from '../test-utils';
import { PaginationComponent } from './pagination.component';

@Component({
  template: `<oib-pagination [page]="currentPage" (pageChanged)="newPage = $event" [navigate]="navigate" />`,
  imports: [PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestPaginationWrapper {
  currentPage: Page<string> | null = null;
  newPage: number | null = null;
  navigate = false;
}

class PaginationComponentTester {
  readonly fixture = TestBed.createComponent(TestPaginationWrapper);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly pagination = this.root.getByCss('ngb-pagination');
  readonly firstPageLink = this.root.getByCss('[aria-label="First"]');
}

describe('PaginationComponent', () => {
  describe('without routing', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TestPaginationWrapper] });
    });

    test('should not display pagination if page is empty', async () => {
      const tester = new PaginationComponentTester();
      tester.fixture.componentInstance.currentPage = emptyPage();
      tester.fixture.detectChanges();
      await expect.element(tester.pagination).not.toBeInTheDocument();
    });

    test('should not display pagination if page is alone', async () => {
      const tester = new PaginationComponentTester();
      tester.fixture.componentInstance.currentPage = toPage(['a'], 1);
      tester.fixture.detectChanges();
      await expect.element(tester.pagination).not.toBeInTheDocument();
    });

    test('should emit event when page changes', async () => {
      const tester = new PaginationComponentTester();
      tester.fixture.componentInstance.currentPage = toPage(['a'], 21, 1, 20);
      tester.fixture.detectChanges();

      await tester.firstPageLink.click();

      expect(tester.fixture.componentInstance.newPage).toBe(0);
    });
  });

  describe('with routing', () => {
    let router: MockObject<Router>;
    let route: Partial<ActivatedRoute>;

    beforeEach(() => {
      route = stubRoute();
      router = createMock(Router);

      TestBed.configureTestingModule({
        imports: [TestPaginationWrapper],
        providers: [
          { provide: ActivatedRoute, useValue: route },
          { provide: Router, useValue: router }
        ]
      });
    });

    test('should not navigate if navigate is false', async () => {
      const tester = new PaginationComponentTester();
      tester.fixture.componentInstance.currentPage = toPage(['a'], 21, 1, 20);
      tester.fixture.detectChanges();

      await tester.firstPageLink.click();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(tester.fixture.componentInstance.newPage).toBe(0);
    });

    test('should navigate if navigate is true', async () => {
      const tester = new PaginationComponentTester();
      tester.fixture.componentInstance.currentPage = toPage(['a'], 21, 1, 20);
      tester.fixture.componentInstance.navigate = true;
      tester.fixture.detectChanges();

      await tester.firstPageLink.click();

      expect(router.navigate).toHaveBeenCalledWith(['.'], {
        relativeTo: route,
        queryParams: { page: 0 },
        queryParamsHandling: 'merge'
      });
      expect(tester.fixture.componentInstance.newPage).toBe(0);
    });
  });
});
