/* eslint-disable @angular-eslint/directive-selector */
import { Directive, inject, input, OnChanges } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * Directive that can be used to set the page title in a template
 */
@Directive({
  selector: 'oib-page-title'
})
export class PageTitleDirective implements OnChanges {
  private readonly titleService = inject(Title);

  /**
   * The mandatory i18n key to use for the title, for example `<oib-page-title />`
   */
  readonly title = input<string>();

  ngOnChanges() {
    this.titleService.setTitle(this.title() ? `OIBus - ${this.title()}` : 'OIBus');
  }
}
