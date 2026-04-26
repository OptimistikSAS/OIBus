import { Component, computed, inject, input, OnChanges, signal, SimpleChanges } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { TransformerService } from '../../../services/transformer.service';
import { CustomTransformerCommandDTO, TransformerTestResponse } from '../../../../../../backend/shared/model/transformer.model';
import { OIBusObjectAttribute } from '../../../../../../backend/shared/model/form.model';
import { addAttributeToForm, addEnablingConditions } from '../../../shared/form/dynamic-form.builder';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ContentDisplayMode } from '../../../south/south-items/south-item-test/item-test-result/item-test-result.component';
import { createPageFromArray, Page } from '../../../../../../backend/shared/model/types';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { FileSizePipe } from '../../../shared/file-size.pipe';
import { DatetimePipe } from '../../../shared/datetime.pipe';
import Papa from 'papaparse';

const PAGE_SIZE = 10;

@Component({
  selector: 'oib-transformer-test',
  templateUrl: './transformer-test.component.html',
  styleUrl: './transformer-test.component.scss',
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    OibCodeBlockComponent,
    OIBusObjectFormControlComponent,
    NgbDropdownModule,
    PaginationComponent,
    FileSizePipe,
    DatetimePipe
  ]
})
export class TransformerTestComponent implements OnChanges {
  private transformerService = inject(TransformerService);
  private fb = inject(NonNullableFormBuilder);

  readonly transformer = input<CustomTransformerCommandDTO | null>(null);

  readonly response = signal<TransformerTestResponse | null>(null);
  readonly error = signal<string>('');
  readonly isLoading = signal<boolean>(false);

  readonly displayMode = signal<ContentDisplayMode | null>(null);
  readonly availableDisplayModes = computed((): Array<ContentDisplayMode> => {
    const r = this.response();
    if (!r) return [];
    const modes: Array<ContentDisplayMode> = [];
    if (r.metadata.contentType === 'json') {
      modes.push('json');
      try {
        if (Array.isArray(JSON.parse(r.output))) modes.push('table');
      } catch {
        // output is not valid JSON; table mode not available
      }
    }
    modes.push('any');
    if (r.metadata.contentFile.endsWith('.csv') && r.output) {
      modes.push('table');
    }
    return modes;
  });

  readonly displayModeIcons: Record<ContentDisplayMode, string> = {
    table: 'fa-table',
    any: 'fa-file-text',
    json: 'fa-code'
  };

  readonly outputLanguage = computed(() => (this.displayMode() === 'json' ? 'json' : 'plaintext'));

  readonly numberOfElements = computed(() => {
    const r = this.response();
    if (!r || r.metadata.contentType !== 'json') return null;
    try {
      return Array.isArray(JSON.parse(r.output)) ? r.metadata.numberOfElement : null;
    } catch {
      return null;
    }
  });

  readonly csvDelimiter = signal<string>(',');

  tableHeaders: Array<string> = [];
  tablePage: Page<Array<string>> = { content: [], totalElements: 0, totalPages: 0, size: PAGE_SIZE, number: 0 };

  form = this.fb.group({
    inputData: ['', Validators.required],
    options: this.fb.group({})
  });
  outputControl = this.fb.control('');

  private prevInputType: string | null = null;
  private prevManifestJson: string | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (!changes['transformer']) return;
    const transformer = this.transformer();
    if (!transformer) {
      this.prevInputType = null;
      this.prevManifestJson = null;
      return;
    }

    if (transformer.inputType !== this.prevInputType) {
      this.prevInputType = transformer.inputType;
      this.loadInputTemplate(transformer.inputType);
    }

    const manifestJson = JSON.stringify(transformer.customManifest.attributes);
    if (manifestJson !== this.prevManifestJson) {
      this.prevManifestJson = manifestJson;
      this.createOptionsForm(transformer.customManifest);
    }
  }

  changeCsvDelimiter(delimiter: string) {
    this.csvDelimiter.set(delimiter);
    this.buildTablePage(0);
  }

  changeDisplayMode(mode: ContentDisplayMode) {
    this.displayMode.set(mode);
    const r = this.response();
    if (!r) return;
    if (mode === 'table') {
      this.buildTablePage(0);
    } else {
      this.setOutputForMode(mode, r.output);
    }
  }

  buildTablePage(pageNumber: number) {
    const r = this.response();
    if (!r) return;

    if (r.metadata.contentFile.endsWith('.csv')) {
      this.buildCsvTablePage(r.output, pageNumber);
    } else {
      this.buildJsonTablePage(r.output, pageNumber);
    }
  }

  private buildCsvTablePage(output: string, pageNumber: number) {
    const rows = Papa.parse<Array<string>>(output, { delimiter: this.csvDelimiter() }).data;
    this.tableHeaders = rows.shift() ?? [];
    this.tablePage = createPageFromArray(rows, PAGE_SIZE, pageNumber);
  }

  private buildJsonTablePage(output: string, pageNumber: number) {
    try {
      const arr = JSON.parse(output) as Array<unknown>;
      if (arr.length > 0 && typeof arr[0] === 'object' && arr[0] !== null) {
        this.tableHeaders = Object.keys(arr[0] as object);
        const rows = (arr as Array<Record<string, unknown>>).map(item =>
          this.tableHeaders.map(h => {
            const val = item[h];
            return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
          })
        );
        this.tablePage = createPageFromArray(rows, PAGE_SIZE, pageNumber);
      } else {
        this.tableHeaders = ['value'];
        this.tablePage = createPageFromArray(
          arr.map(item => [String(item)]),
          PAGE_SIZE,
          pageNumber
        );
      }
    } catch {
      this.tablePage = { content: [], totalElements: 0, totalPages: 0, size: PAGE_SIZE, number: 0 };
    }
  }

  private loadInputTemplate(inputType: string) {
    this.isLoading.set(true);
    this.error.set('');
    this.transformerService.getInputTemplate(inputType).subscribe({
      next: template => {
        this.form.patchValue({ inputData: template.data });
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set('Failed to load input template: ' + err.message);
        this.isLoading.set(false);
      }
    });
  }

  private createOptionsForm(manifest: OIBusObjectAttribute) {
    this.form.setControl('options', this.fb.group({}));
    for (const attribute of manifest.attributes) {
      addAttributeToForm(this.fb, this.form.controls.options, attribute);
    }
    addEnablingConditions(this.form.controls.options, manifest.enablingConditions);
  }

  private setOutputForMode(mode: ContentDisplayMode, output: string) {
    if (mode === 'json') {
      try {
        this.outputControl.setValue(JSON.stringify(JSON.parse(output), null, 2));
      } catch {
        this.outputControl.setValue(output);
      }
    } else {
      this.outputControl.setValue(output);
    }
  }

  test() {
    const transformer = this.transformer();
    if (!this.form.valid || !transformer) return;

    const formValue = this.form.value;
    this.isLoading.set(true);
    this.error.set('');
    this.response.set(null);
    this.displayMode.set(null);

    this.transformerService
      .test(transformer, {
        inputData: formValue.inputData!,
        options: formValue.options || {}
      })
      .subscribe({
        next: response => {
          this.error.set('');
          this.response.set(response);
          const modes = this.availableDisplayModes();
          const initialMode = modes[0] ?? null;
          this.displayMode.set(initialMode);
          if (initialMode === 'table') {
            this.buildTablePage(0);
          } else if (initialMode) {
            this.setOutputForMode(initialMode, response.output);
          }
          this.isLoading.set(false);
        },
        error: err => {
          this.response.set(null);
          this.displayMode.set(null);
          this.error.set(err.message);
          this.isLoading.set(false);
        }
      });
  }
}
