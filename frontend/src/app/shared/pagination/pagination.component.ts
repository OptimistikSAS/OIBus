import { Component, EventEmitter, Input, Optional, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Page } from '../../../../../shared/model/types';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { NgIf } from '@angular/common';

@Component({
  selector: 'oib-pagination',
  templateUrl: './pagination.component.html',
  styleUrls: ['./pagination.component.scss'],
  imports: [NgbPaginationModule, NgIf],
  standalone: true
})
export class PaginationComponent {
  @Input() page: Page<any> | null = null;
  @Output() readonly pageChanged = new EventEmitter<number>();

  @Input() navigate = false;

  constructor(@Optional() private router: Router, @Optional() private route: ActivatedRoute) {}

  onPageChanged($event: number) {
    const newPage = $event - 1;
    this.pageChanged.emit(newPage);

    if (this.navigate && this.router && this.route) {
      this.router.navigate(['.'], { relativeTo: this.route, queryParams: { page: newPage }, queryParamsHandling: 'merge' });
    }
  }
}
