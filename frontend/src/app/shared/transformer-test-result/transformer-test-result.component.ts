import { ChangeDetectionStrategy, Component, contentChild, Directive, effect, input, signal, viewChild } from '@angular/core';

import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { OIBusContent } from '@oibus/shared/common/content.model';

import {
  ContentDisplayMode,
  ItemTestResultComponent
} from '../../south/south-items/south-item-test/item-test-result/item-test-result.component';

type PipelinePanes = 'both' | 'raw' | 'output';

/** Marks the actions a parent projects into the result, shown on the far right of the choice of the panes */
@Directive({
  selector: '[oibPipelineActions]'
})
export class PipelineActionsDirective {}

/**
 * Displays a transformer test as raw result and transformer output side by side (single column when
 * no transformer is involved). Reuses {@link ItemTestResultComponent} for each content section. The
 * output section is hidden until a transformer is provided (raw-only case). Either section can be shown alone, on the full
 * width. Actions projected with {@link PipelineActionsDirective} sit on the far right of that choice, on their own row without
 * a transformer.
 */
@Component({
  selector: 'oib-transformer-test-result',
  templateUrl: './transformer-test-result.component.html',
  styleUrl: './transformer-test-result.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe, NgbDropdownModule, ItemTestResultComponent]
})
export class TransformerTestResultComponent {
  readonly raw = input<OIBusContent | null>(null);
  readonly hasTransformer = input<boolean>(false);
  readonly output = input<OIBusContent | null>(null);
  readonly actions = contentChild(PipelineActionsDirective);

  /** The panes shown once a transformer is involved: both side by side, or one of them on the full width */
  readonly panes = signal<PipelinePanes>('both');
  readonly paneChoices: ReadonlyArray<PipelinePanes> = ['both', 'raw', 'output'];

  readonly rawView = viewChild<ItemTestResultComponent>('rawView');
  readonly outputView = viewChild<ItemTestResultComponent>('outputView');

  readonly rawModes = signal<Array<ContentDisplayMode>>([]);
  readonly rawMode = signal<ContentDisplayMode | null>(null);
  readonly outputModes = signal<Array<ContentDisplayMode>>([]);
  readonly outputMode = signal<ContentDisplayMode | null>(null);

  constructor() {
    effect(() => {
      const content = this.raw();
      const view = this.rawView();
      if (view && content) {
        view.displayResult(content);
      }
    });
    effect(() => {
      const content = this.output();
      const view = this.outputView();
      if (view && content) {
        view.displayResult(content);
      }
    });
  }

  changeRawMode(mode: ContentDisplayMode) {
    this.rawView()?.changeDisplayMode(mode);
    this.rawView()?.displayResult();
  }

  changeOutputMode(mode: ContentDisplayMode) {
    this.outputView()?.changeDisplayMode(mode);
    this.outputView()?.displayResult();
  }
}
