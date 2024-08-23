import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SingleSelectComponent } from '../../shared/single-select/single-select.component';
import { SimpleSingleSelectOptionComponent } from '../../shared/single-select/single-select-simple-option';
import { RichSingleSelectOptionComponent } from '../../shared/single-select/single-select-rich-option';
import { TransformerCommandDTO, TransformerDTO } from '../../../../../shared/model/transformer.model';
import { TransformerService } from '../../services/transformer.service';
import { Modal, ModalService } from '../../shared/modal.service';
import { EditTransformerModalComponent } from './edit-transformer-modal/edit-transformer-modal.component';
import { NotificationService } from '../../shared/notification.service';
import { forkJoin } from 'rxjs';

type Selectable<TValue = any> = { value: TValue; selected: boolean };
export type TableState = Array<{
  input: string;
  outputs: Array<Selectable<string>>;
  transformerTypes: Array<Selectable<string>>;
  transformers: Array<Selectable<TransformerDTO>>;
}>;

@Component({
  selector: 'oib-north-transformers',
  standalone: true,
  imports: [
    TranslateModule,
    BoxComponent,
    BoxTitleDirective,
    OibHelpComponent,
    NgbDropdownModule,
    SingleSelectComponent,
    SimpleSingleSelectOptionComponent,
    RichSingleSelectOptionComponent
  ],
  templateUrl: './north-transformers.component.html',
  styleUrl: './north-transformers.component.scss'
})
export class NorthTransformersComponent implements OnInit {
  @Input() transformersManifest: NonNullable<NorthConnectorManifest['transformers']> = [];
  @Input() northId: string | null = null;

  tableState: TableState = [];
  allTransformers: Array<TransformerDTO> = [];
  selectedTransformerIds: Array<string> = [];

  constructor(
    private transformerService: TransformerService,
    private modalService: ModalService,
    private notificationService: NotificationService,
    private cd: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.initializeTableState();
  }

  getSelectedValue<TType>(options: Array<Selectable<TType>>): TType | undefined {
    return options.find(o => o.selected)?.value;
  }

  getTransformerTypes(input: string, output: string) {
    const possibleTransformerTypes = [
      ...new Set(this.transformersManifest.filter(t => t.inputType === input && t.outputType === output).map(t => t.type))
    ];

    if (possibleTransformerTypes.length === 1) {
      return possibleTransformerTypes.map(value => ({ value, selected: value === possibleTransformerTypes[0] }));
    }

    let defaultType = '';
    if (this.getTransformers(input, output).find(t => t.selected)) {
      defaultType = 'custom';
    } else {
      defaultType = 'standard';
    }

    return possibleTransformerTypes.map(value => ({ value, selected: value === defaultType }));
  }

  // Selection change handlers

  onOutputChange(selectedOutput: string, rowIndex: number) {
    const prevSelectedOutput = this.getSelectedValue(this.tableState[rowIndex].outputs);

    this.tableState[rowIndex].outputs.forEach(o => (o.selected = false));
    this.tableState[rowIndex].outputs.find(o => o.value === selectedOutput)!.selected = true;

    this.tableState[rowIndex].transformerTypes = this.getTransformerTypes(this.tableState[rowIndex].input, selectedOutput);

    // If type changes, and there was a previously selected transformer, unassign it
    const selectedTransformerId = this.getSelectedValue(this.tableState[rowIndex].transformers)?.id;

    if (prevSelectedOutput && selectedTransformerId && prevSelectedOutput != selectedOutput) {
      this.transformerService.unassign(selectedTransformerId, { northId: this.northId! }).subscribe(() => {
        this.changeTransformerSelectionInState(selectedTransformerId, undefined, rowIndex);
      });
    }
  }

  onTransformerTypeChange(selectedType: string, rowIndex: number) {
    const prevSelectedType = this.getSelectedValue(this.tableState[rowIndex].transformerTypes);

    // Update selected type
    this.tableState[rowIndex].transformerTypes.forEach(t => (t.selected = false));
    this.tableState[rowIndex].transformerTypes.find(t => t.value === selectedType)!.selected = true;

    // Update the list of available transformers when the type is custom
    if (selectedType === 'custom') {
      const inputType = this.tableState[rowIndex].input;
      const outputType = this.getSelectedValue(this.tableState[rowIndex].outputs)!;

      this.tableState[rowIndex].transformers = this.getTransformers(inputType, outputType);

      this.cd.detectChanges();
      return;
    }

    // Otherwise, the type is standard, so no transformers to show
    const selectedTransformerId = this.getSelectedValue(this.tableState[rowIndex].transformers)?.id;

    // If the prev state was custom and now is standard, unassign any selected transformers
    if (prevSelectedType === 'custom' && selectedTransformerId) {
      this.transformerService.unassign(selectedTransformerId, { northId: this.northId! }).subscribe(() => {
        this.changeTransformerSelectionInState(selectedTransformerId, undefined, rowIndex);
        this.tableState[rowIndex].transformers = [];
      });

      return;
    }

    this.tableState[rowIndex].transformers = [];
  }

  private initializeTableState() {
    forkJoin({
      allTransformers: this.transformerService.list(),
      selectedTransformers: this.transformerService.list({}, { northId: this.northId! })
    }).subscribe(({ allTransformers, selectedTransformers }) => {
      this.allTransformers = allTransformers;
      this.selectedTransformerIds = selectedTransformers.map(t => t.id);

      const possibleInputs = [...new Set(this.transformersManifest.map(t => t.inputType))];

      for (const input of possibleInputs) {
        const outputs = this.getOutputs(input);

        const output = this.getSelectedValue(outputs)!;
        const transformerTypes = this.getTransformerTypes(input, output);

        const transformers = this.getTransformers(input, output);
        this.tableState.push({ input, outputs, transformerTypes, transformers });
      }

      this.cd.detectChanges();
    });
  }

  private getOutputs(input: string) {
    const possibleOutputs = [...new Set(this.transformersManifest.filter(t => t.inputType === input).map(t => t.outputType))];
    const selectedOutputType = this.getSelectedValue(this.getTransformers(input))?.outputType;

    if (selectedOutputType) {
      return possibleOutputs.map(value => ({ value, selected: value === selectedOutputType }));
    }

    return possibleOutputs.map((value, idx) => ({ value, selected: idx === 0 }));
  }

  private getTransformers(input: string, output: string | undefined = undefined): Array<Selectable<TransformerDTO>> {
    const possible: Array<TransformerDTO> = this.allTransformers.filter(t =>
      output ? t.inputType === input && t.outputType === output : t.inputType === input
    );
    const transformers: Array<Selectable<TransformerDTO>> = possible.map(t => ({
      value: t,
      selected: this.selectedTransformerIds.includes(t.id)
    }));

    return transformers;
  }

  onSelectTransformer(newTransformerId: string | undefined, rowIndex: number) {
    if (!newTransformerId) {
      return;
    }

    const prevTransformerId = this.getSelectedValue(this.tableState[rowIndex].transformers)?.id;
    if (newTransformerId === prevTransformerId) {
      return;
    }

    if (prevTransformerId) {
      this.transformerService.unassign(prevTransformerId, { northId: this.northId! }).subscribe(() => {
        this.transformerService.assign(newTransformerId, { northId: this.northId! }).subscribe(() => {
          this.changeTransformerSelectionInState(prevTransformerId, newTransformerId, rowIndex);
          this.notificationService.success(`transformer.assigned`);
        });
      });
    } else {
      this.transformerService.assign(newTransformerId, { northId: this.northId! }).subscribe(() => {
        this.changeTransformerSelectionInState(prevTransformerId, newTransformerId, rowIndex);
        this.notificationService.success(`transformer.assigned`);
      });
    }
  }

  private changeTransformerSelectionInState(
    deselectTransformerId: string | undefined,
    selectTransformerId: string | undefined,
    rowIndex: number
  ) {
    // Deselect previous id
    if (deselectTransformerId) {
      const selectable = this.tableState[rowIndex].transformers.find(t => t.value.id === deselectTransformerId);
      if (selectable) selectable.selected = false;
      this.selectedTransformerIds = this.selectedTransformerIds.filter(id => id !== deselectTransformerId);
    }

    // Select current id
    if (selectTransformerId) {
      this.tableState[rowIndex].transformers.find(t => t.value.id === selectTransformerId)!.selected = true;
      this.selectedTransformerIds.push(selectTransformerId);
    }
  }

  // Create transformer

  onCreateTransformer(event: MouseEvent, rowIndex: number) {
    event.stopPropagation();

    const modalRef = this.modalService.open(EditTransformerModalComponent, { size: 'xl' });
    const component: EditTransformerModalComponent = modalRef.componentInstance;
    const { input: inputType, outputs } = this.tableState[rowIndex];
    const outputType = this.getSelectedValue(outputs)!;
    component.prepareForCreation(inputType, outputType);
    this.refreshAfterCreationModalClosed(modalRef, rowIndex);
  }

  private refreshAfterCreationModalClosed(modalRef: Modal<any>, rowIndex: number) {
    modalRef.result.subscribe(transformerCommand => {
      this.transformerService.create(transformerCommand).subscribe(newTransformer => {
        this.createTransformerInState(newTransformer, rowIndex);
        this.notificationService.success(`transformer.created`);
      });
    });
  }

  private createTransformerInState(newTransformer: TransformerDTO, rowIndex: number) {
    // Add it to the table state
    this.tableState[rowIndex].transformers.push({ value: newTransformer, selected: false });
    // Add it to all transformers
    this.allTransformers.push(newTransformer);
  }

  // Edit transformer

  onEditTransformer(event: MouseEvent, transformer: TransformerDTO, rowIndex: number) {
    event.stopPropagation();

    const modalRef = this.modalService.open(EditTransformerModalComponent, { size: 'xl' });
    const component: EditTransformerModalComponent = modalRef.componentInstance;
    component.prepareForEdition(transformer);
    this.refreshAfterEditModalClosed(modalRef, transformer.id, rowIndex);
  }

  private refreshAfterEditModalClosed(modalRef: Modal<any>, transformerId: string, rowIndex: number) {
    modalRef.result.subscribe(transformerCommand => {
      this.transformerService.update(transformerId, transformerCommand).subscribe(() => {
        this.editTransformerInState(transformerId, transformerCommand, rowIndex);
        this.notificationService.success(`transformer.updated`);
      });
    });
  }

  private editTransformerInState(transformerId: string, transformerCommand: TransformerCommandDTO, rowIndex: number) {
    // Prepare the new transformer object
    const transformerDto = { ...transformerCommand, id: transformerId };

    // Update in table state
    this.tableState[rowIndex].transformers = this.tableState[rowIndex].transformers.map(t => {
      if (t.value.id !== transformerId) return t;
      return { ...t, value: transformerDto };
    });

    // Update in all transformers
    this.allTransformers = this.allTransformers.map(t => {
      if (t.id !== transformerId) return t;
      return transformerDto;
    });
  }

  // Delete transformer

  onDeleteTransformer(event: MouseEvent, transformer: TransformerDTO, rowIndex: number) {
    event.stopPropagation();
    this.refreshAfterDelete(transformer.id, rowIndex);
  }

  private refreshAfterDelete(transformerId: string, rowIndex: number) {
    // TODO: Add confirm modal to delete transformer
    this.transformerService.unassign(transformerId, { northId: this.northId! }).subscribe(() => {
      this.transformerService.delete(transformerId).subscribe(() => {
        this.deleteTransformerInState(transformerId, rowIndex);
        this.notificationService.success(`transformer.deleted`);
      });
    });
  }

  private deleteTransformerInState(transformerId: string, rowIndex: number) {
    // Remove from table state
    this.tableState[rowIndex].transformers = this.tableState[rowIndex].transformers.filter(t => t.value.id !== transformerId);

    // Remove from all transformers
    this.allTransformers = this.allTransformers.filter(t => t.id !== transformerId);

    // Remove from selected transformer ids (if present)
    this.selectedTransformerIds = this.selectedTransformerIds.filter(id => id !== transformerId);
  }
}
