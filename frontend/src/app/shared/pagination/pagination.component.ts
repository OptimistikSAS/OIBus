import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

import { Page } from '@oibus/shared/common/types';

@Component({
  selector: 'oib-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbPaginationModule]
})
export class PaginationComponent {
  private readonly router = inject(Router, { optional: true });
  private readonly route = inject(ActivatedRoute, { optional: true });

  readonly page = input<Page<unknown> | null>(null);
  readonly pageChanged = output<number>();

  readonly navigate = input(false);

  onPageChanged($event: number) {
    const newPage = $event - 1;
    this.pageChanged.emit(newPage);

    if (this.navigate() && this.router && this.route) {
      this.router.navigate(['.'], {
        relativeTo: this.route,
        queryParams: { page: newPage },
        queryParamsHandling: 'merge'
      });
    }
  }
}
