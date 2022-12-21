import { Inject, LOCALE_ID, NgModule } from '@angular/core';
import { MissingTranslationHandler, MissingTranslationHandlerParams, TranslateModule, TranslateService } from '@ngx-translate/core';
import EN_TRANSLATIONS from './en.json';

export class CustomMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams) {
    throw new Error(`Missing translation for key ${params.key}`);
  }
}

@NgModule({
  imports: [
    TranslateModule.forRoot({
      useDefaultLang: false,
      missingTranslationHandler: { provide: MissingTranslationHandler, useClass: CustomMissingTranslationHandler }
    })
  ],
  exports: [TranslateModule],
  providers: [{ provide: LOCALE_ID, useValue: 'en' }]
})
export class MockI18nModule {
  constructor(translateService: TranslateService, @Inject(LOCALE_ID) locale: string) {
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
  }
}
