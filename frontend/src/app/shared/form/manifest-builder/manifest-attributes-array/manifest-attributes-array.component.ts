import { Component, computed, inject, input, output } from '@angular/core';
import { ControlContainer, FormControl, FormGroupName, ReactiveFormsModule } from '@angular/forms';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { startWith, switchMap } from 'rxjs';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BoxComponent, BoxTitleDirective } from '../../../box/box.component';
import { PaginationComponent } from '../../../pagination/pagination.component';
import type { Modal } from '../../../modal.service';
import { ModalService } from '../../../modal.service';
import { ArrayPage } from '../../../pagination/array-page';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
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
  imports: [ReactiveFormsModule, TranslatePipe, TranslateDirective, BoxComponent, BoxTitleDirective, PaginationComponent, NgbTooltip]
})
export class ManifestAttributesArrayComponent {
  private modalService = inject(ModalService);

  NUMBER_OF_ELEMENT_PER_PAGE = 20;
  control = input.required<FormControl<Array<any>>>();
  label = input.required<string>();
  contextPath = input<Array<string>>([]);

  // Emit when nested data changes (for parent modals to react)
  nestedChange = output<void>();

  private readonly controlValue = toSignal(toObservable(this.control).pipe(switchMap(c => c.valueChanges.pipe(startWith(c.value)))));
  readonly paginatedValues = computed(() => {
    return new ArrayPage(this.controlValue()!, this.NUMBER_OF_ELEMENT_PER_PAGE);
  });

  async addItem(event: Event) {
    event.preventDefault();
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForCreation(this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  async copyItem(element: any) {
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForEdition({ ...element, key: element.key + '_copy' }, this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      this.control().setValue([...this.control().value, arrayElement]);
      this.paginatedValues().gotoPage(0);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  async editItem(element: any) {
    const modal = await this.openAttributeEditor();
    const depth = this.contextPath().length;

    modal.componentInstance.prepareForEdition(element, this.contextPath(), depth);

    modal.result.subscribe(arrayElement => {
      const newArray = [...this.control().value];
      const index = this.control().value.indexOf(element);
      newArray[index] = { ...arrayElement, id: element.id };

      this.control().setValue(newArray);
      this.paginatedValues().gotoPage(0);
      this.control().markAsDirty();
      this.nestedChange.emit();
    });
  }

  deleteItem(element: any) {
    const newArray = [...this.control().value];
    const index = this.control().value.indexOf(element);
    newArray.splice(index, 1);
    this.control().setValue(newArray);
    this.paginatedValues().gotoPage(0);
    this.control().markAsDirty();
    this.nestedChange.emit();
  }

  private async openAttributeEditor(): Promise<Modal<ManifestAttributeEditorModalComponent>> {
    const { ManifestAttributeEditorModalComponent } = await import(
      '../manifest-attribute-editor-modal/manifest-attribute-editor-modal.component'
    );
    return this.modalService.open<ManifestAttributeEditorModalComponent>(ManifestAttributeEditorModalComponent, {
      size: 'lg'
    });
  }
}
