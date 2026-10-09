import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { ControlContainer, FormControl, FormGroupName, ReactiveFormsModule } from '@angular/forms';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';

import { OIBusAttribute } from '@oibus/shared/connector/form.model';

import { BoxComponent, BoxTitleDirective } from '../../../box/box.component';
import type { Modal } from '../../../modal.service';
import { ModalService } from '../../../modal.service';
import { ArrayPage } from '../../../pagination/array-page';
import { PaginationComponent } from '../../../pagination/pagination.component';
import { trackControl } from '../../tracked-control';
import type { ManifestAttributeEditorModalComponent } from '../manifest-attribute-editor-modal/manifest-attribute-editor-modal.component';

@Component({
  selector: 'oib-manifest-attributes-array',
  templateUrl: './manifest-attributes-array.component.html',
  styleUrl: './manifest-attributes-array.component.scss',
  viewProviders: [
    {
      provide: ControlContainer,
      useExisting: FormGroupName
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, TranslateDirective, BoxComponent, BoxTitleDirective, PaginationComponent, NgbTooltip]
})
export class ManifestAttributesArrayComponent {
  private readonly modalService = inject(ModalService);

  readonly NUMBER_OF_ELEMENT_PER_PAGE = 20;
  readonly control = input.required<FormControl<Array<OIBusAttribute>>>();
  readonly label = input.required<string>();
  readonly contextPath = input<Array<string>>([]);

  // Emit when nested data changes (for parent modals to react)
  readonly nestedChange = output<void>();

  /** The control is tracked so that this OnPush component renders the value set from outside (e.g. by the parent editor) */
  private readonly trackedControl = trackControl(() => this.control());
  private readonly controlValue = computed(() => this.trackedControl()!.value);
  // back to the first page when the value changes
  readonly pageNumber = linkedSignal({ source: this.controlValue, computation: () => 0 });
  readonly paginatedValues = computed(() => new ArrayPage(this.controlValue(), this.NUMBER_OF_ELEMENT_PER_PAGE, this.pageNumber()));

  async addItem(event: Event) {
    event.preventDefault();
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForCreation(this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  async copyItem(element: OIBusAttribute) {
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForEdition({ ...element, key: element.key + '_copy' }, this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  async editItem(element: OIBusAttribute) {
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForEdition(element, this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      const newArray = [...this.control().value];
      const index = this.control().value.indexOf(element);
      newArray[index] = arrayElement;

      this.control().setValue(newArray);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  deleteItem(element: OIBusAttribute) {
    const newArray = [...this.control().value];
    const index = this.control().value.indexOf(element);
    newArray.splice(index, 1);
    this.control().setValue(newArray);
    this.control().markAsDirty();
    this.nestedChange.emit();
  }

  private async openAttributeEditor(): Promise<Modal<ManifestAttributeEditorModalComponent>> {
    const { ManifestAttributeEditorModalComponent } =
      await import('../manifest-attribute-editor-modal/manifest-attribute-editor-modal.component');
    return this.modalService.open<ManifestAttributeEditorModalComponent>(ManifestAttributeEditorModalComponent, {
      size: 'lg'
    });
  }
}
