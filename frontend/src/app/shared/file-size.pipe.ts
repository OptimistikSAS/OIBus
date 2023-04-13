import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Pipe used to display a file size in bytes in the appropriate unit of display.
 */
@Pipe({
  name: 'fileSize',
  pure: false,
  standalone: true
})
export class FileSizePipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(size: number): string {
    const ONE_KB = 1024;
    const ONE_MB = 1024 * ONE_KB;

    if (size > ONE_MB) {
      const mBytes = this.translateService.instant('common.size.MB');
      const sizeInMB = size / ONE_MB;
      return `${sizeInMB.toFixed(1)} ${mBytes}`;
    } else if (size > ONE_KB) {
      const kBytes = this.translateService.instant('common.size.kB');
      const sizeInkB = size / ONE_KB;
      return `${sizeInkB.toFixed(1)} ${kBytes}`;
    } else {
      const bytes = this.translateService.instant('common.size.B');
      return `${size} ${bytes}`;
    }
  }
}
