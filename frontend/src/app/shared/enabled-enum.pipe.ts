import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'enabled',
  pure: false,
  standalone: true
})
export class EnabledEnumPipe implements PipeTransform {
  constructor(private translateService: TranslateService) {}

  transform(enabled: boolean): string {
    if (enabled) {
      return this.translateService.instant('enabled');
    } else {
      return this.translateService.instant('disabled');
    }
  }
}
