import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Observable } from 'rxjs';

import { SouthConnectorItemCommandDTO } from '@oibus/shared/api/south-connector.model';
import { ALL_CSV_CHARACTERS, createPageFromArray, CsvCharacter, Page } from '@oibus/shared/common/types';
import { OIBusAttribute, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { isDisplayableAttribute } from '../../../shared/form/dynamic-form.builder';
import { CsvValidationError, MqttTopicValidationError, validateCsvHeaders, validateCsvMqttTopics } from '../../../shared/form/validators';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { ObservableState } from '../../../shared/save-button/save-button.component';
import { convertCsvDelimiter } from '../../../shared/utils/csv.utils';
import { emptyPage } from '../../../shared/utils/page.utils';

const PAGE_SIZE = 20;

export interface SouthItemsCheckResult {
  items: Array<SouthConnectorItemCommandDTO>;
  errors: Array<{ item: Record<string, string>; error: string }>;
}

@Component({
  selector: 'oib-import-south-items-modal',
  templateUrl: './import-south-items-modal.component.html',
  styleUrl: './import-south-items-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, PaginationComponent, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export class ImportSouthItemsModalComponent {
  private modal = inject(NgbActiveModal);
  private translateService = inject(TranslateService);
  private fb = inject(NonNullableFormBuilder);

  state = new ObservableState();

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  initializeFile = new File([''], 'Choose a file');
  readonly selectedFile = signal<File>(this.initializeFile);
  readonly validationError = signal<CsvValidationError | null>(null);
  readonly mqttValidationError = signal<MqttTopicValidationError | null>(null);
  readonly checking = signal(false);
  readonly checkError = signal<string | null>(null);

  form = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    eraseExisting: [false]
  });

  expectedHeaders: Array<string> = [];
  optionalHeaders: Array<string> = [];
  existingMqttTopics: Array<string> = [];
  isMqttConnector = false;
  readonly showEraseOption = signal(false);
  private checkFn!: (file: File, delimiter: string, deleteItemsNotPresent: boolean) => Observable<SouthItemsCheckResult>;

  displaySettings: Array<OIBusAttribute> = [];
  readonly newItemList = signal<Array<SouthConnectorItemCommandDTO>>([]);
  readonly errorList = signal<Array<{ item: Record<string, string>; error: string }>>([]);
  readonly displayedItemsNew = signal<Page<SouthConnectorItemCommandDTO>>(emptyPage());
  readonly displayedItemsError = signal<Page<{ item: Record<string, string>; error: string }>>(emptyPage());

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
    this.showEraseOption.set(showEraseOption);
    this.checkFn = checkFn;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      attribute => attribute.key === 'settings'
    )! as OIBusObjectAttribute;
    this.displaySettings = itemSettingsManifest.attributes.filter(setting => isDisplayableAttribute(setting));
  }

  get canImport(): boolean {
    return (
      this.selectedFile() !== this.initializeFile &&
      !this.validationError() &&
      !this.mqttValidationError() &&
      !this.checking() &&
      this.newItemList().length > 0
    );
  }

  async onFileSelected(file: File): Promise<void> {
    this.selectedFile.set(file);
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
      items: this.newItemList(),
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
    this.displayedItemsNew.set(createPageFromArray(this.newItemList(), PAGE_SIZE, pageNumber));
  }

  changePageError(pageNumber: number) {
    this.displayedItemsError.set(createPageFromArray(this.errorList(), PAGE_SIZE, pageNumber));
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
    this.validationError.set(null);
    this.mqttValidationError.set(null);
    this.checkError.set(null);
    this.resetResults();

    const selectedFile = this.selectedFile();
    if (selectedFile === this.initializeFile) {
      return;
    }

    const delimiter = convertCsvDelimiter(this.form.controls.delimiter.value);
    this.validationError.set(await validateCsvHeaders(selectedFile, delimiter, this.expectedHeaders, this.optionalHeaders));

    if (!this.validationError() && this.isMqttConnector) {
      this.mqttValidationError.set(await validateCsvMqttTopics(selectedFile, delimiter, this.existingMqttTopics));
    }

    if (!this.validationError() && !this.mqttValidationError()) {
      await this.runCheck();
    }
  }

  private async runCheck(): Promise<void> {
    const selectedFile = this.selectedFile();
    if (selectedFile === this.initializeFile || this.validationError() || this.mqttValidationError()) {
      return;
    }

    const delimiter = convertCsvDelimiter(this.form.controls.delimiter.value);
    const eraseExisting = this.form.controls.eraseExisting.value;
    this.checking.set(true);
    this.checkError.set(null);
    try {
      const result = await firstValueFrom(this.checkFn(selectedFile, delimiter, eraseExisting));
      this.newItemList.set(result.items);
      this.errorList.set(result.errors);
      this.changePageNew(0);
      this.changePageError(0);
    } catch (error: unknown) {
      this.checkError.set((error as { error?: { message?: string }; message?: string }).error?.message || 'Unknown error');
      this.resetResults();
    } finally {
      this.checking.set(false);
    }
  }

  private resetResults(): void {
    this.newItemList.set([]);
    this.errorList.set([]);
    this.displayedItemsNew.set(emptyPage());
    this.displayedItemsError.set(emptyPage());
  }
}
