import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Observable } from 'rxjs';

import { HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '@oibus/shared/api/history-query.model';
import { ALL_CSV_CHARACTERS, createPageFromArray, CsvCharacter, Page } from '@oibus/shared/common/types';
import { OIBusAttribute, OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { isDisplayableAttribute } from '../../../shared/form/dynamic-form.builder';
import { CsvValidationError, validateCsvHeaders } from '../../../shared/form/validators';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { ObservableState } from '../../../shared/save-button/save-button.component';
import { convertCsvDelimiter } from '../../../shared/utils/csv.utils';
import { emptyPage } from '../../../shared/utils/page.utils';

const PAGE_SIZE = 20;

export interface HistoryQueryItemsCheckResult {
  items: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>;
  errors: Array<{ item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO; error: string }>;
}

@Component({
  selector: 'oib-import-history-query-items-modal',
  templateUrl: './import-history-query-items-modal.component.html',
  styleUrl: './import-history-query-items-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, PaginationComponent, TranslatePipe, NgbTooltip, ReactiveFormsModule]
})
export class ImportHistoryQueryItemsModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly state = new ObservableState();

  readonly csvDelimiters = ALL_CSV_CHARACTERS;
  private readonly initializeFile = new File([''], 'Choose a file');
  readonly selectedFile = signal<File>(this.initializeFile);
  readonly validationError = signal<CsvValidationError | null>(null);
  readonly checking = signal(false);
  readonly checkError = signal<string | null>(null);

  readonly form = this.fb.group({
    delimiter: ['COMMA' as CsvCharacter, Validators.required],
    eraseExisting: [false]
  });

  private expectedHeaders: Array<string> = [];
  private optionalHeaders: Array<string> = [];
  readonly showEraseOption = signal(false);
  private checkFn!: (file: File, delimiter: string, deleteItemsNotPresent: boolean) => Observable<HistoryQueryItemsCheckResult>;

  readonly displaySettings = signal<Array<OIBusAttribute>>([]);
  readonly newItemList = signal<Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>>([]);
  readonly errorList = signal<Array<{ item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO; error: string }>>([]);
  readonly displayedItemsNew = signal<Page<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>>(emptyPage());
  readonly displayedItemsError = signal<Page<{ item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO; error: string }>>(emptyPage());

  readonly canImport = computed(
    () => this.selectedFile() !== this.initializeFile && !this.validationError() && !this.checking() && this.newItemList().length > 0
  );

  prepare(
    manifest: SouthConnectorManifest,
    expectedHeaders: Array<string>,
    optionalHeaders: Array<string>,
    showEraseOption: boolean,
    checkFn: (file: File, delimiter: string, deleteItemsNotPresent: boolean) => Observable<HistoryQueryItemsCheckResult>
  ) {
    this.expectedHeaders = expectedHeaders;
    this.optionalHeaders = optionalHeaders;
    this.showEraseOption.set(showEraseOption);
    this.checkFn = checkFn;
    const itemSettingsManifest = manifest.items.rootAttribute.attributes.find(
      element => element.key === 'settings'
    )! as OIBusObjectAttribute;
    this.displaySettings.set(itemSettingsManifest.attributes.filter(setting => isDisplayableAttribute(setting)));
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

  getFieldValue(settings: object, field: string): string {
    const value: unknown = (settings as Record<string, unknown>)[field];
    const foundFormControl = this.displaySettings().find(formControl => formControl.key === field);
    if (foundFormControl && value && foundFormControl.type === 'string-select') {
      return this.translateService.instant(`${foundFormControl.translationKey}.${value}`);
    }
    return value == null ? '' : String(value);
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
    this.checkError.set(null);
    this.resetResults();

    const selectedFile = this.selectedFile();
    if (selectedFile === this.initializeFile) {
      return;
    }

    const delimiter = convertCsvDelimiter(this.form.controls.delimiter.value);
    this.validationError.set(await validateCsvHeaders(selectedFile, delimiter, this.expectedHeaders, this.optionalHeaders));

    if (!this.validationError()) {
      await this.runCheck();
    }
  }

  private async runCheck(): Promise<void> {
    const selectedFile = this.selectedFile();
    if (selectedFile === this.initializeFile || this.validationError()) {
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
