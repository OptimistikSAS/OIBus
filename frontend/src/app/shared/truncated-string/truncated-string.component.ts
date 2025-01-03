import { ChangeDetectionStrategy, Component, input, computed, numberAttribute } from '@angular/core';
import { NgbPopover } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'oib-truncated-string',
  templateUrl: './truncated-string.component.html',
  styleUrl: './truncated-string.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgbPopover]
})
export class TruncatedStringComponent {
  readonly string = input.required<string | null | undefined>();
  readonly maxLength = input(40, {
    transform: numberAttribute
  });
  readonly truncated = computed(() => {
    const string = this.string();
    return string && string.length > this.maxLength();
  });
  readonly displayedString = computed(() => {
    if (this.truncated()) {
      return this.string()!.substring(0, this.maxLength());
    } else {
      return this.string() ?? '';
    }
  });
}
