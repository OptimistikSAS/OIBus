import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ScanModeDTO } from '../../../../backend/shared/model/scan-mode.model';

/**
 * Renders a scan mode's schedule as a short human-readable string: the raw cron expression for a
 * cron scan mode, something like "every 30 s" for an interval one.
 */
@Pipe({
  name: 'scanModeSchedule'
})
export class ScanModeSchedulePipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(scanMode: ScanModeDTO | null | undefined): string {
    if (!scanMode) {
      return '';
    }
    if (scanMode.type === 'interval' && scanMode.interval) {
      return this.translateService.instant('engine.scan-mode.schedule-every', {
        value: scanMode.interval.value,
        unit: this.translateService.instant(`engine.scan-mode.interval-unit-short.${scanMode.interval.unit}`)
      });
    }
    return scanMode.cron ?? '';
  }
}

/**
 * Whether a scan mode's activation window can never fire again. Kept as a helper so templates do
 * not depend on the DTO field name directly.
 */
export function isScanModeWindowExpired(scanMode: ScanModeDTO | null | undefined): boolean {
  return scanMode?.activationWindowExpired === true;
}
