import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';
import { NgIf } from '@angular/common';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-truncated-string',
  standalone: true,
  templateUrl: './truncated-string.component.html',
  styleUrl: './truncated-string.component.scss',
  imports: [NgIf, NgbPopover],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TruncatedStringComponent implements OnChanges {
  @Input({ required: true }) string: string | null | undefined;
  @Input() maxLength: number = 40;
  displayedString: string = '';
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
