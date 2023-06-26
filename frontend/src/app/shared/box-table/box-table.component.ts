import {
 AfterContentInit,
 ChangeDetectionStrategy,
 ContentChildren,
 Directive,
 Input,
 QueryList,
 TemplateRef
} from '@angular/core';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { NgIf, NgTemplateOutlet } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Component } from '@angular/core';
//import { CommonModule } from '@angular/common';

@Directive({
  standalone: true,
  selector: 'ng-template[oibBoxTitle]'
})

export class BoxTitleDirective {
  constructor(public templateRef: TemplateRef<void>) {}
}

@Component({
  selector: 'oib-box-table',
  standalone: true,
  imports: [NgbCollapse, NgIf, NgTemplateOutlet, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './box-table.component.html',
  styleUrls: ['./box-table.component.scss'],
})

export class BoxTableComponent implements AfterContentInit {
  @Input() boxTitle = '';
  titleTemplateRef: TemplateRef<void> | null = null;

  @ContentChildren(BoxTitleDirective, { descendants: false }) titleQuery: QueryList<BoxTitleDirective> | undefined;

  ngAfterContentInit(): void {
    this.titleTemplateRef = this.titleQuery?.first?.templateRef || null;
  }
}
