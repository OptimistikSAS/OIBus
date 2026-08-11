import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateDirective, TranslateService } from '@ngx-translate/core';
import { NorthConnectorService } from '../../../services/north-connector.service';
import { HistoryQueryService } from '../../../services/history-query.service';
import { NorthConnectorLightDTO } from '../../../../../../backend/shared/model/north-connector.model';
import { HistoryQueryLightDTO } from '../../../../../../backend/shared/model/history-query.model';
import { TransformerDTO } from '../../../../../../backend/shared/model/transformer.model';

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

  norths: Array<NorthConnectorLightDTO> = [];
  historyQueries: Array<HistoryQueryLightDTO> = [];

  selectedSourceId: string | null = null;
  selectedAttachmentId: string | null = null;
  attachments: Array<SelectableAttachment> = [];
  loading = false;

  constructor() {
    this.northConnectorService.list().subscribe(norths => {
      this.norths = norths;
    });
    this.historyQueryService.list().subscribe(historyQueries => {
      this.historyQueries = historyQueries;
    });
    // Reset the selection whenever the caller switches between north connectors and history queries.
    effect(() => {
      this.sourceKind();
      this.selectedSourceId = null;
      this.selectedAttachmentId = null;
      this.attachments = [];
    });
  }

  onSourceChange() {
    this.selectedAttachmentId = null;
    this.attachments = [];
    if (!this.selectedSourceId) {
      return;
    }

    this.loading = true;
    if (this.sourceKind() === 'north') {
      this.northConnectorService.findById(this.selectedSourceId).subscribe(northConnector => {
        this.loading = false;
        this.attachments = northConnector.transformers
          .filter(transformerWithOptions => this.supportedOutputTypes().includes(transformerWithOptions.transformer.outputType))
          .map(transformerWithOptions => ({
            id: transformerWithOptions.id,
            label:
              transformerWithOptions.source.type === 'south'
                ? `${this.transformerLabel(transformerWithOptions.transformer)} (${transformerWithOptions.source.south.name})`
                : this.transformerLabel(transformerWithOptions.transformer),
            transformer: transformerWithOptions.transformer,
            options: transformerWithOptions.options
          }));
      });
    } else {
      this.historyQueryService.findById(this.selectedSourceId).subscribe(historyQuery => {
        this.loading = false;
        this.attachments = historyQuery.northTransformers
          .filter(transformerWithOptions => this.supportedOutputTypes().includes(transformerWithOptions.transformer.outputType))
          .map(transformerWithOptions => ({
            id: transformerWithOptions.id,
            label: this.transformerLabel(transformerWithOptions.transformer),
            transformer: transformerWithOptions.transformer,
            options: transformerWithOptions.options
          }));
      });
    }
  }

  onAttachmentChange() {
    const attachment = this.attachments.find(element => element.id === this.selectedAttachmentId);
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
