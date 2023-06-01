import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ContentChildren,
  Directive,
  Input,
  QueryList,
  TemplateRef
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
 * A reusable box component with a title and a content.
 * The title can be simple text, or can be a ng-template.
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

  @ContentChildren(BoxTitleDirective, { descendants: false }) titleQuery: QueryList<BoxTitleDirective> | undefined;

  ngAfterContentInit(): void {
    this.titleTemplateRef = this.titleQuery?.first?.templateRef || null;
  }
}
