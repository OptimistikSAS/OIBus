import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Page } from '../../../../../shared/model/types';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-pagination',
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
  imports: [NgbPaginationModule],
  standalone: true
})
export class PaginationComponent {
  private router = inject(Router, { optional: true });
  private route = inject(ActivatedRoute, { optional: true });

  @Input() page: Page<any> | null = null;
  @Output() readonly pageChanged = new EventEmitter<number>();

  @Input() navigate = false;

  onPageChanged($event: number) {
    const newPage = $event - 1;
    this.pageChanged.emit(newPage);

    if (this.navigate && this.router && this.route) {
      this.router.navigate(['.'], { relativeTo: this.route, queryParams: { page: newPage }, queryParamsHandling: 'merge' });
    }
  }
}
