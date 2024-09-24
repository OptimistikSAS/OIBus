import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  Directive,
  ElementRef,
  Input,
  TemplateRef,
  ViewChild,
  inject
} from '@angular/core';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { OibHelpComponent } from '../oib-help/oib-help.component';

@Directive({
  standalone: true,
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
  standalone: true,
  templateUrl: './box.component.html',
  styleUrl: './box.component.scss',
  imports: [NgbCollapse, NgTemplateOutlet, TranslateModule, OibHelpComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoxComponent implements AfterContentInit {
  @Input() boxTitle = '';
  @Input() helpUrl = '';
  titleTemplateRef: TemplateRef<void> | null = null;
  removePadding = false;
  @Input() imagePath = '';

  @ViewChild('boxContent', { static: true }) boxContent: ElementRef<any> | undefined;
  @ContentChild(BoxTitleDirective, { static: true }) titleQuery: BoxTitleDirective | undefined;

  ngAfterContentInit(): void {
    this.titleTemplateRef = this.titleQuery?.templateRef || null;
    this.checkContent();
  }

  private checkContent(): void {
    const contentElement = this.boxContent?.nativeElement;

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
