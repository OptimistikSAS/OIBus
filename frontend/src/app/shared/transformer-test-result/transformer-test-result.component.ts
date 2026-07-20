import { ChangeDetectionStrategy, Component, effect, input, viewChild } from '@angular/core';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import {
  ContentDisplayMode,
  ItemTestResultComponent
} from '../../south/south-items/south-item-test/item-test-result/item-test-result.component';
import { OIBusContent } from '../../../../../backend/shared/model/engine.model';

/**
 * Displays a transformer test as raw result and transformer output side by side (single column when
 * no transformer is involved). Reuses {@link ItemTestResultComponent} for each content section. The
 * output section is hidden until a transformer is provided (raw-only case).
 */
@Component({
  selector: 'oib-transformer-test-result',
  templateUrl: './transformer-test-result.component.html',
  styleUrl: './transformer-test-result.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, TranslatePipe, NgbDropdownModule, ItemTestResultComponent]
})
export class TransformerTestResultComponent {
  readonly raw = input<OIBusContent | null>(null);
  readonly hasTransformer = input<boolean>(false);
  readonly output = input<OIBusContent | null>(null);

  readonly rawView = viewChild<ItemTestResultComponent>('rawView');
  readonly outputView = viewChild<ItemTestResultComponent>('outputView');

  rawModes: Array<ContentDisplayMode> = [];
  rawMode: ContentDisplayMode | null = null;
  outputModes: Array<ContentDisplayMode> = [];
  outputMode: ContentDisplayMode | null = null;

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
