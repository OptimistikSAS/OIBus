import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  Directive,
  ElementRef,
  Input,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { NgIf, NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Directive({
  standalone: true,
  selector: 'ng-template[oibBoxTitle]'
})
export class BoxTitleDirective {
  constructor(public templateRef: TemplateRef<void>) {}
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
  styleUrls: ['./box.component.scss'],
  imports: [NgbCollapse, NgIf, NgTemplateOutlet, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BoxComponent implements AfterContentInit {
  @Input() boxTitle = '';
  titleTemplateRef: TemplateRef<void> | null = null;
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
      const emptyDivElements = contentElement.querySelectorAll('div:empty');

      contentElement.classList.remove('has-empty-div', 'has-table', 'has-alert-warning'); // Deletes the existing class

      if (tableElement) {
        contentElement.classList.add('has-table');
      }
      if (emptyDivElements.length <= 0) {
        contentElement.classList.add('has-empty-div');
      }
      if (alertWarningElement) {
        contentElement.classList.add('has-alert-warning');
      }
    }
  }
}
