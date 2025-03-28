import { Component, inject, output, input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Page } from '../../../../../backend/shared/model/types';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
  imports: [NgbPaginationModule]
})
export class PaginationComponent {
  private router = inject(Router, { optional: true });
  private route = inject(ActivatedRoute, { optional: true });

  readonly page = input<Page<any> | null>(null);
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
