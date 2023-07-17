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
  imagePath = '';

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

      contentElement.classList.remove('has-empty-div'); // Supprime la classe existante

      if (tableElement) {
        contentElement.classList.add('has-table');
      }
      if (emptyDivElements.length >= 0) {
        contentElement.classList.add('has-empty-div');
      }
      if (alertWarningElement) {
        contentElement.classList.add('has-alert-warning');
      }
    }

    // Assign image path based on boxTitle
    if (this.boxTitle.includes('home.south.title')) {
      this.imagePath = '../../assets/home/south.svg';
    } else if (this.boxTitle.includes('home.north.title')) {
      this.imagePath = '../../assets/home/north.svg';
    } else if (this.boxTitle.includes('home.history-query.title')) {
      this.imagePath = '../../assets/home/history-query.svg';
    }
  }
}
