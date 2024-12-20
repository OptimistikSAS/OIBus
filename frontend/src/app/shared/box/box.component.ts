import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  TemplateRef,
  inject,
  viewChild,
  contentChild,
  input,
  computed
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateDirective } from '@ngx-translate/core';
import { OibHelpComponent } from '../oib-help/oib-help.component';

@Directive({
  selector: 'ng-template[oibBoxTitle]'
})
export class BoxTitleDirective {
  templateRef = inject<TemplateRef<void>>(TemplateRef);
}

/**
 * A reusable box component with a title and content.
 * The title can be simple text, or an ng-template.
 * The content is always projected content.
 */
@Component({
  selector: 'oib-box',
  templateUrl: './box.component.html',
  styleUrl: './box.component.scss',
  imports: [NgTemplateOutlet, TranslateDirective, OibHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoxComponent {
  readonly boxTitle = input('');
  readonly helpUrl = input('');
  readonly removePadding = computed(() => this.isPaddingRemoved());
  readonly imagePath = input('');

  readonly boxContent = viewChild.required<ElementRef<HTMLDivElement>>('boxContent');
  readonly titleQuery = contentChild(BoxTitleDirective);
  readonly titleTemplateRef = computed(() => this.titleQuery()?.templateRef || null);

  private isPaddingRemoved(): boolean {
    const contentElement = this.boxContent()?.nativeElement;
    if (contentElement) {
      const tableElement = contentElement.querySelector('table');
      const alertWarningElement = contentElement.querySelector('.alert-warning');
      const emptyDivElements = contentElement.querySelectorAll('div');
      // Only match empty containers when that's the only thing in the box
      const greyContainerElement = contentElement.querySelector(':scope > div > div.oib-grey-container');
      const normalContentElement = contentElement.querySelector('.row');

      if (tableElement || emptyDivElements.length <= 0 || alertWarningElement || greyContainerElement) {
        return true;
      }
      if (normalContentElement) {
        return false;
      }
    }
    return false;
  }
}
