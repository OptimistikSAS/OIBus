import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { DatetimePipe } from '../datetime.pipe';

/**
 * Displays the "updated on" date of an entity, with a hover overlay detailing the full audit trail
 * (created on / created by / updated by). Used in list tables where the created/updated-by columns
 * have been collapsed into a single "updated on" column.
 */
@Component({
  selector: 'oib-audit-info',
  templateUrl: './audit-info.component.html',
  styleUrl: './audit-info.component.scss',
  imports: [NgbTooltip, TranslateDirective, TranslatePipe, DatetimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditInfoComponent {
  readonly createdAt = input.required<string>();
  readonly createdBy = input.required<string>();
  readonly updatedAt = input.required<string>();
  readonly updatedBy = input.required<string>();
}
