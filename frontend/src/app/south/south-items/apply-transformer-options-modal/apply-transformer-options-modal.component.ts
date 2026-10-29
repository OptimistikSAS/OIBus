import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';

import { NorthConnectorDTO } from '@oibus/shared/api/north-connector.model';
import { SourceOriginSouthDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';

import { transformerName } from '../../../north/north-summary';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { OIBusSettingsSummaryComponent } from '../../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import { compareSettings, countChanges, summarizeSettings } from '../../../shared/form/oibus-settings-summary/settings-summary';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';

/** The items shown by name, the others counted */
const SHOWN_ITEMS = 20;

/** What applying options to the transformer of a North changes: the transformer, its new options, and the items it sends */
export interface TransformerOptionsChange {
  north: NorthConnectorDTO;
  /** The transformer of the North, as saved */
  transformer: TransformerDTOWithOptions & { source: SourceOriginSouthDTO };
  options: Record<string, unknown>;
  /** The names of the items of the south the North sends through the transformer */
  impactedItems: Array<string>;
  /** Whether the item is being edited: the change is saved right away, without waiting for the item */
  itemEdited: boolean;
}

/**
 * Confirms that options tried out on a south item are applied to the transformer of a North: what changes, and every item of
 * the south it sends to the North. Saves the transformer, and closes with it once saved.
 */
@Component({
  selector: 'oib-apply-transformer-options-modal',
  templateUrl: './apply-transformer-options-modal.component.html',
  imports: [TranslateDirective, TranslatePipe, OIBusSettingsSummaryComponent, SaveButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApplyTransformerOptionsModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly translateService = inject(TranslateService);

  readonly state = new ObservableState();
  readonly change = signal<TransformerOptionsChange | null>(null);

  readonly transformerName = computed(() => {
    const change = this.change();
    return change ? transformerName(change.transformer.transformer, this.translateService) : '';
  });
  readonly options = computed(() => this.summarize(this.change()?.options));
  readonly savedOptions = computed(() => this.summarize(this.change()?.transformer.options));
  readonly changeCount = computed(() => countChanges(compareSettings(this.options(), this.savedOptions())));
  readonly shownItems = computed(() => this.change()?.impactedItems.slice(0, SHOWN_ITEMS) ?? []);
  readonly hiddenItemCount = computed(() => Math.max((this.change()?.impactedItems.length ?? 0) - SHOWN_ITEMS, 0));

  prepare(change: TransformerOptionsChange) {
    this.change.set(change);
  }

  private summarize(options: Record<string, unknown> | undefined) {
    const change = this.change();
    return change && options
      ? summarizeSettings(change.transformer.transformer.manifest, options, {
          translateService: this.translateService,
          applyEnablingConditions: true
        })
      : [];
  }

  apply() {
    const change = this.change()!;
    const transformer: TransformerDTOWithOptions = { ...change.transformer, options: change.options };
    this.northConnectorService
      .addOrEditTransformer(change.north.id, transformer)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(() => this.modal.close(transformer));
  }

  cancel() {
    this.modal.dismiss();
  }
}
