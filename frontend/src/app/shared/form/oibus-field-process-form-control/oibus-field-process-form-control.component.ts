import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FieldOperation } from '@oibus/shared/connector/field-process.model';
import { OIBusFieldProcessAttribute } from '@oibus/shared/connector/form.model';

import { FieldProcessModalComponent } from '../../field-process-modal/field-process-modal.component';
import { FieldProcessSamplesService } from '../../field-process-modal/field-process-samples.service';
import { ModalService } from '../../modal.service';
import { trackControl } from '../tracked-control';

/**
 * The operations processing the values of a field (see `OIBusFieldProcessAttribute`): their names in order, and a button
 * opening the modal where they are set up and tested on the first values of the field - those of the last transformer test.
 */
@Component({
  selector: 'oib-oibus-field-process-form-control',
  templateUrl: './oibus-field-process-form-control.component.html',
  styleUrl: './oibus-field-process-form-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, TranslatePipe]
})
export class OIBusFieldProcessFormControlComponent {
  private readonly modalService = inject(ModalService);
  private readonly translateService = inject(TranslateService);
  private readonly samples = inject(FieldProcessSamplesService);

  readonly fieldProcessAttribute = input.required<OIBusFieldProcessAttribute>();
  /** The group of the attribute, holding the processed field too */
  readonly group = input.required<FormGroup>();

  private readonly control = trackControl(() => this.group().get(this.fieldProcessAttribute().key));
  private readonly fieldControl = trackControl(() => this.group().get(this.fieldProcessAttribute().fieldKey));
  readonly operations = computed<Array<FieldOperation>>(() => this.control()?.value ?? []);

  open() {
    const field: string = this.fieldControl()?.value ?? '';
    const modalRef = this.modalService.open(FieldProcessModalComponent, { size: 'lg', backdrop: 'static' });
    modalRef.componentInstance.initialize(
      field || this.translateService.instant(this.fieldProcessAttribute().translationKey),
      this.operations(),
      field ? this.samples.valuesOf(field) : []
    );
    modalRef.result.subscribe((operations: Array<FieldOperation>) => {
      const control = this.control()!;
      control.setValue(operations);
      control.markAsDirty();
    });
  }
}
