import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

/**
 * The steps of a wizard modal, shown between its header and body: every step can be opened at any time, the current one
 * stands out, and those with errors are flagged.
 */
@Component({
  selector: 'oib-modal-steps',
  templateUrl: './modal-steps.component.html',
  styleUrl: './modal-steps.component.scss',
  imports: [TranslateDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModalStepsComponent<S extends string> {
  /** The steps, in order */
  readonly steps = input.required<ReadonlyArray<S>>();
  readonly current = model.required<S>();
  /** Translation key prefix of the step labels, completed by the step */
  readonly labelPrefix = input.required<string>();
  /** Translation key of the accessible name of the steps */
  readonly ariaLabel = input.required<string>();
  /** Prefix of the step button ids, completed by the step */
  readonly idPrefix = input('modal-step-');
  readonly invalidSteps = input<ReadonlyArray<S>>([]);
}
