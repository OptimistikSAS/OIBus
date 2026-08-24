import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';

interface AuditDiffRow {
  key: string;
  before: unknown;
  after: unknown;
  changed: boolean;
}

/**
 * Displays a key-level diff between the previous and new state of an audited entity.
 * `previousState` is `null` for a CREATE action, `newState` is `null` for a DELETE action.
 */
@Component({
  selector: 'oib-audit-diff',
  templateUrl: './audit-diff.component.html',
  styleUrl: './audit-diff.component.scss',
  imports: [TranslateDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuditDiffComponent {
  readonly previousState = input.required<Record<string, unknown> | null>();
  readonly newState = input.required<Record<string, unknown> | null>();

  readonly rows = computed<Array<AuditDiffRow>>(() => {
    const before = this.previousState() ?? {};
    const after = this.newState() ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
    return keys.map(key => ({
      key,
      before: key in before ? before[key] : undefined,
      after: key in after ? after[key] : undefined,
      changed: JSON.stringify(before[key]) !== JSON.stringify(after[key])
    }));
  });

  formatValue(value: unknown): string {
    if (value === undefined) {
      return '—';
    }
    if (value === null) {
      return 'null';
    }
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
