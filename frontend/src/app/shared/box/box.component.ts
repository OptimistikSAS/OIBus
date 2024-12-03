import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  Input,
  TemplateRef,
  inject,
  viewChild,
  contentChild
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
export class BoxComponent implements AfterContentInit {
  @Input() boxTitle = '';
  @Input() helpUrl = '';
  // TODO Signal migration: use a computed
  titleTemplateRef: TemplateRef<void> | null = null;
  // TODO Signal migration: use a computed
  removePadding = false;
  @Input() imagePath = '';

  readonly boxContent = viewChild.required<ElementRef<HTMLDivElement>>('boxContent');
  readonly titleQuery = contentChild(BoxTitleDirective);

  ngAfterContentInit(): void {
    this.titleTemplateRef = this.titleQuery()?.templateRef || null;
    this.checkContent();
  }

  private checkContent(): void {
    const contentElement = this.boxContent()?.nativeElement;

    if (contentElement) {
      const tableElement = contentElement.querySelector('table');
      const alertWarningElement = contentElement.querySelector('.alert-warning');
      const emptyDivElements = contentElement.querySelectorAll('div');
      const greyContainerElement = contentElement.querySelector('.oib-grey-container');
      const multipleContentElement = contentElement.querySelector('oib-form');
      const normalContentElement = contentElement.querySelector('.row');

      if (tableElement || emptyDivElements.length <= 0 || alertWarningElement || greyContainerElement || multipleContentElement) {
        this.removePadding = true;
      }
      if (normalContentElement) {
        this.removePadding = false;
      }
    }
  }
}
