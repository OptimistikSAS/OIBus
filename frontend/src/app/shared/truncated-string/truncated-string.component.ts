import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-truncated-string',
  templateUrl: './truncated-string.component.html',
  styleUrl: './truncated-string.component.scss',
  imports: [NgbPopover],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TruncatedStringComponent implements OnChanges {
  @Input({ required: true }) string: string | null | undefined;
  @Input() maxLength = 40;
  displayedString = '';
  truncated = false;

  ngOnChanges() {
    if (this.string) {
      if (this.string.length > this.maxLength) {
        this.displayedString = this.string.substring(0, this.maxLength);
        this.truncated = true;
      } else {
        this.displayedString = this.string;
        this.truncated = false;
      }
    } else {
      this.displayedString = '';
      this.truncated = false;
    }
  }
}
