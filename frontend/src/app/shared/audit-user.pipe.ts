import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { UserInfo } from '../../../../backend/shared/model/types';

// Non-real users recording changes, whose display name must be translated
const TRANSLATED_USER_IDS = ['oianalytics', 'system'];

/**
 * Displays the user who performed an audited change: its friendly name, or a translated label for
 * the OIAnalytics and system users.
 */
@Pipe({
  name: 'auditUser',
  pure: false
})
export class AuditUserPipe implements PipeTransform {
  private translateService = inject(TranslateService);

  transform(user: UserInfo | null | undefined): string {
    if (!user) {
      return '';
    }
    if (TRANSLATED_USER_IDS.includes(user.id)) {
      return this.translateService.instant(`audit.users.${user.id}`);
    }
    return user.friendlyName || user.id;
  }
}
