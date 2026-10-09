import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';

import { beforeEach, describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';

import { Page } from '@oibus/shared/common/types';

import { createMock, MockObject, stubRoute } from '../../../test/vitest-create-mock';
import { emptyPage, toPage } from '../utils/page.utils';
import { PaginationComponent } from './pagination.component';

@Component({
  template: `<oib-pagination [page]="currentPage()" (pageChanged)="newPage.set($event)" [navigate]="navigate()" />`,
  imports: [PaginationComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestPaginationWrapper {
  readonly currentPage = signal<Page<string> | null>(null);
  readonly newPage = signal<number | null>(null);
  readonly navigate = signal(false);
}

class PaginationComponentTester {
  readonly fixture = TestBed.createComponent(TestPaginationWrapper);
  readonly root = page.elementLocator(this.fixture.nativeElement);
  readonly pagination = this.root.getByRole('navigation');
  readonly firstPageLink = this.root.getByRole('link', { name: 'First' });
  readonly pageLinks = this.root.getByCss('li.page-item');
  readonly activePage = this.root.getByCss('li.page-item.active');

  setPage(currentPage: Page<string> | null) {
    this.fixture.componentInstance.currentPage.set(currentPage);
  }
}

describe('PaginationComponent', () => {
  describe('without routing', () => {
    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [TestPaginationWrapper] });
    });

    test('should not display pagination without page', async () => {
      const tester = new PaginationComponentTester();
      await expect.element(tester.pagination).not.toBeInTheDocument();
    });

    test('should not display pagination if page is empty', async () => {
      const tester = new PaginationComponentTester();
      tester.setPage(emptyPage());
      await expect.element(tester.pagination).not.toBeInTheDocument();
    });

    test('should not display pagination if page is alone', async () => {
      const tester = new PaginationComponentTester();
      tester.setPage(toPage(['a'], 1));
      await expect.element(tester.pagination).not.toBeInTheDocument();
    });

    test('should display the current page and follow page changes from the parent', async () => {
      const tester = new PaginationComponentTester();
      tester.setPage(toPage(['a'], 21, 1, 20));
      await expect.element(tester.activePage).toHaveTextContent('2');

      tester.setPage(toPage(['a'], 21, 0, 20));
      await expect.element(tester.activePage).toHaveTextContent('1');
    });

    test('should emit event when page changes', async () => {
      const tester = new PaginationComponentTester();
      tester.setPage(toPage(['a'], 21, 1, 20));

      await tester.firstPageLink.click();

      expect(tester.fixture.componentInstance.newPage()).toBe(0);
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
      tester.setPage(toPage(['a'], 21, 1, 20));

      await tester.firstPageLink.click();

      expect(router.navigate).not.toHaveBeenCalled();
      expect(tester.fixture.componentInstance.newPage()).toBe(0);
    });

    test('should navigate if navigate is true', async () => {
      const tester = new PaginationComponentTester();
      tester.setPage(toPage(['a'], 21, 1, 20));
      tester.fixture.componentInstance.navigate.set(true);

      await tester.firstPageLink.click();

      expect(router.navigate).toHaveBeenCalledWith(['.'], {
        relativeTo: route,
        queryParams: { page: 0 },
        queryParamsHandling: 'merge'
      });
      expect(tester.fixture.componentInstance.newPage()).toBe(0);
    });
  });
});
