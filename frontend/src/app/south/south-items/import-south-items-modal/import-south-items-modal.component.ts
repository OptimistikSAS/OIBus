import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ObservableState } from '../../../shared/save-button/save-button.component';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Observable } from 'rxjs';
import { SouthConnectorItemCommandDTO, SouthConnectorManifest } from '../../../../../../backend/shared/model/south-connector.model';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { ALL_CSV_CHARACTERS, createPageFromArray, CsvCharacter, Page } from '../../../../../../backend/shared/model/types';
import { emptyPage } from '../../../shared/test-utils';
import { isDisplayableAttribute } from '../../../shared/form/dynamic-form.builder';
import { OIBusAttribute, OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { CsvValidationError, MqttTopicValidationError, validateCsvHeaders, validateCsvMqttTopics } from '../../../shared/form/validators';
import { convertCsvDelimiter } from '../../../shared/utils/csv.utils';

const PAGE_SIZE = 20;

export interface SouthItemsCheckResult {
  items: Array<SouthConnectorItemCommandDTO>;
  errors: Array<{ item: Record<string, string>; error: string }>;
}

@Component({
  selector: 'oib-import-south-items-modal',
  templateUrl: './import-south-items-modal.component.html',
  styleUrl: './import-south-items-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [TranslateDirective, PaginationComponent, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export class ImportSouthItemsModalComponent {
  private modal = inject(NgbActiveModal);
  private translateService = inject(TranslateService);
  private fb = inject(NonNullableFormBuilder);

  state = new ObservableState();

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  initializeFile = new File([''], 'Choose a file');
  selectedFile: File = this.initializeFile;
  validationError: CsvValidationError | null = null;
  mqttValidationError: MqttTopicValidationError | null = null;
  checking = false;
  checkError: string | null = null;

  form = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    eraseExisting: [false]
  });

  expectedHeaders: Array<string> = [];
  optionalHeaders: Array<string> = [];
  existingMqttTopics: Array<string> = [];
  isMqttConnector = false;
  showEraseOption = false;
  private checkFn!: (file: File, delimiter: string, deleteItemsNotPresent: boolean) => Observable<SouthItemsCheckResult>;

  displaySettings: Array<OIBusAttribute> = [];
  newItemList: Array<SouthConnectorItemCommandDTO> = [];
  errorList: Array<{ item: Record<string, string>; error: string }> = [];
  displayedItemsNew: Page<SouthConnectorItemCommandDTO> = emptyPage();
  displayedItemsError: Page<{ item: Record<string, string>; error: string }> = emptyPage();

  prepare(
    manifest: SouthConnectorManifest,
    expectedHeaders: Array<string>,
    optionalHeaders: Array<string>,
    existingMqttTopics: Array<string>,
    isMqttConnector: boolean,
    showEraseOption: boolean,
    checkFn: (file: File, delimiter: string, deleteItemsNotPresent: boolean) => Observable<SouthItemsCheckResult>
  ) {
    this.expectedHeaders = expectedHeaders;
    this.optionalHeaders = optionalHeaders;
    this.existingMqttTopics = existingMqttTopics;
    this.isMqttConnector = isMqttConnector;
    this.showEraseOption = showEraseOption;
    this.checkFn = checkFn;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    this.displaySettings = itemSettingsManifest.attributes.filter(setting => isDisplayableAttribute(setting));
  }

  get canImport(): boolean {
    return (
      this.selectedFile !== this.initializeFile &&
      !this.validationError &&
      !this.mqttValidationError &&
      !this.checking &&
      this.newItemList.length > 0
    );
  }

  async onFileSelected(file: File): Promise<void> {
    this.selectedFile = file;
    await this.revalidateAndCheck();
  }

  async onDelimiterChange(): Promise<void> {
    await this.revalidateAndCheck();
  }

  async onEraseExistingChange(): Promise<void> {
    await this.runCheck();
  }

  cancel() {
    this.modal.dismiss();
  }

  submit() {
    this.modal.close({
      items: this.newItemList,
      eraseExisting: this.form.controls.eraseExisting.value
    });
  }

  getFieldValue(element: any, field: string): string {
    const foundFormControl = this.displaySettings.find(formControl => formControl.key === field);
    if (foundFormControl && element[field] && foundFormControl.type === 'string-select') {
      return this.translateService.instant(foundFormControl.translationKey + '.' + element[field]);
    }
    return element[field] || '';
  }

  getGroupNoneText(): string {
    return this.translateService.instant('south.items.group-none');
  }

  changePageNew(pageNumber: number) {
    this.displayedItemsNew = createPageFromArray(this.newItemList, PAGE_SIZE, pageNumber);
  }

  changePageError(pageNumber: number) {
    this.displayedItemsError = createPageFromArray(this.errorList, PAGE_SIZE, pageNumber);
  }

  onImportDragOver(e: Event) {
    e.preventDefault();
  }

  async onImportDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer!.files![0];
    if (file) {
      await this.onFileSelected(file);
    }
  }

  async onImportClick(e: Event) {
    const fileInput = e.target as HTMLInputElement;
    const file = fileInput!.files![0];
    if (file) {
      await this.onFileSelected(file);
      fileInput.value = '';
    }
  }

  private async revalidateAndCheck(): Promise<void> {
    this.validationError = null;
    this.mqttValidationError = null;
    this.checkError = null;
    this.resetResults();

    if (this.selectedFile === this.initializeFile) {
      return;
    }

    const delimiter = convertCsvDelimiter(this.form.controls.delimiter.value);
    this.validationError = await validateCsvHeaders(this.selectedFile, delimiter, this.expectedHeaders, this.optionalHeaders);

    if (!this.validationError && this.isMqttConnector) {
      this.mqttValidationError = await validateCsvMqttTopics(this.selectedFile, delimiter, this.existingMqttTopics);
    }

    if (!this.validationError && !this.mqttValidationError) {
      await this.runCheck();
    }
  }

  private async runCheck(): Promise<void> {
    if (this.selectedFile === this.initializeFile || this.validationError || this.mqttValidationError) {
      return;
    }

    const delimiter = convertCsvDelimiter(this.form.controls.delimiter.value);
    const eraseExisting = this.form.controls.eraseExisting.value;
    this.checking = true;
    this.checkError = null;
    try {
      const result = await firstValueFrom(this.checkFn(this.selectedFile, delimiter, eraseExisting));
      this.newItemList = result.items;
      this.errorList = result.errors;
      this.changePageNew(0);
      this.changePageError(0);
    } catch (error: unknown) {
      this.checkError = (error as { error?: { message?: string }; message?: string }).error?.message || 'Unknown error';
      this.resetResults();
    } finally {
      this.checking = false;
    }
  }

  private resetResults(): void {
    this.newItemList = [];
    this.errorList = [];
    this.displayedItemsNew = emptyPage();
    this.displayedItemsError = emptyPage();
  }
}
