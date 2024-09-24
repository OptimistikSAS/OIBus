/* eslint-disable @angular-eslint/directive-selector */
import { Directive, Input, OnChanges, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * Directive that can be used to set the page title in a template
 */
@Directive({
  selector: 'oib-page-title',
  standalone: true
})
export class PageTitleDirective implements OnChanges {
  private titleService = inject(Title);

  /**
   * The mandatory i18n key to use for the title, for example `<oib-page-title />`
   */
  @Input() title: string | undefined;

  ngOnChanges() {
    this.titleService.setTitle(`OIBus - ${this.title}`);
  }
}
