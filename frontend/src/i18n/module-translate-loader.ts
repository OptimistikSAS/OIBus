import { TranslateLoader } from '@ngx-translate/core';
import { from, Observable } from 'rxjs';

export class ModuleTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<any> {
    return from(import(`./${lang}.json`).then(m => m.default));
  }
}
