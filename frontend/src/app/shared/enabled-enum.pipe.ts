import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'enabled',
  pure: false,
  standalone: true
})
export class EnabledEnumPipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(enabled: boolean): string {
    if (enabled) {
      return this.translateService.instant('enabled');
    } else {
      return this.translateService.instant('disabled');
    }
  }
}
