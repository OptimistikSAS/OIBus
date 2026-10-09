import { Injectable } from '@angular/core';

import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { from, Observable } from 'rxjs';

@Injectable()
export class ModuleTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return from(import(`./locales/${lang}.json`).then(m => m.default));
  }
}
