import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateDirective, TranslateService } from '@ngx-translate/core';

import { HistoryQueryLightDTO } from '@oibus/shared/api/history-query.model';
import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { TransformerDTO } from '@oibus/shared/api/transformer.model';

import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorService } from '../../../services/north-connector.service';

interface SelectableAttachment {
  id: string;
  label: string;
  transformer: TransformerDTO;
  options: Record<string, unknown>;
}

/**
 * Lets the user browse the transformers already attached to another North connector or History query, and pick one
 * as a starting point (its transformer type + options are copied) for a new transformer attachment. Used by the
 * north and history-query "add transformer" modals when the user chooses to copy from an existing north/history
 * transformer instead of starting from scratch.
 */
@Component({
  selector: 'oib-select-existing-transformer',
  templateUrl: './select-existing-transformer.component.html',
  styleUrl: './select-existing-transformer.component.scss',
  imports: [FormsModule, TranslateDirective],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class SelectExistingTransformerComponent {
  private northConnectorService = inject(NorthConnectorService);
  private historyQueryService = inject(HistoryQueryService);
  private translateService = inject(TranslateService);

  /** Whether to browse north connectors or history queries. */
  readonly sourceKind = input.required<'north' | 'history-query'>();
  /** Only transformers whose output type is in this list are selectable. */
  readonly supportedOutputTypes = input.required<Array<string>>();

  readonly transformerPicked = output<{ transformer: TransformerDTO; options: Record<string, unknown> }>();

  readonly norths = signal<Array<NorthConnectorLightDTO>>([]);
  readonly historyQueries = signal<Array<HistoryQueryLightDTO>>([]);

  readonly selectedSourceId = signal<string | null>(null);
  readonly selectedAttachmentId = signal<string | null>(null);
  readonly attachments = signal<Array<SelectableAttachment>>([]);
  readonly loading = signal(false);

  constructor() {
    this.northConnectorService.list().subscribe(norths => {
      this.norths.set(norths);
    });
    this.historyQueryService.list().subscribe(historyQueries => {
      this.historyQueries.set(historyQueries);
    });
    // Reset the selection whenever the caller switches between north connectors and history queries.
    effect(() => {
      this.sourceKind();
      this.selectedSourceId.set(null);
      this.selectedAttachmentId.set(null);
      this.attachments.set([]);
    });
  }

  onSourceChange() {
    this.selectedAttachmentId.set(null);
    this.attachments.set([]);
    const selectedSourceId = this.selectedSourceId();
    if (!selectedSourceId) {
      return;
    }

    this.loading.set(true);
    if (this.sourceKind() === 'north') {
      this.northConnectorService.findById(selectedSourceId).subscribe(northConnector => {
        this.loading.set(false);
        this.attachments.set(
          northConnector.transformers
            .filter(transformerWithOptions => this.supportedOutputTypes().includes(transformerWithOptions.transformer.outputType))
            .map(transformerWithOptions => ({
              id: transformerWithOptions.id,
              label:
                transformerWithOptions.source.type === 'south'
                  ? `${this.transformerLabel(transformerWithOptions.transformer)} (${transformerWithOptions.source.south.name})`
                  : this.transformerLabel(transformerWithOptions.transformer),
              transformer: transformerWithOptions.transformer,
              options: transformerWithOptions.options
            }))
        );
      });
    } else {
      this.historyQueryService.findById(selectedSourceId).subscribe(historyQuery => {
        this.loading.set(false);
        this.attachments.set(
          historyQuery.northTransformers
            .filter(transformerWithOptions => this.supportedOutputTypes().includes(transformerWithOptions.transformer.outputType))
            .map(transformerWithOptions => ({
              id: transformerWithOptions.id,
              label: this.transformerLabel(transformerWithOptions.transformer),
              transformer: transformerWithOptions.transformer,
              options: transformerWithOptions.options
            }))
        );
      });
    }
  }

  onAttachmentChange() {
    const attachment = this.attachments().find(element => element.id === this.selectedAttachmentId());
    if (attachment) {
      this.transformerPicked.emit({ transformer: attachment.transformer, options: attachment.options });
    }
  }

  private transformerLabel(transformer: TransformerDTO): string {
    return transformer.type === 'standard'
      ? this.translateService.instant('configuration.oibus.manifest.transformers.standard.' + transformer.functionName)
      : transformer.name;
  }
}
