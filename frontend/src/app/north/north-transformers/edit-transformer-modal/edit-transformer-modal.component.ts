// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../../../../node_modules/monaco-editor/monaco.d.ts" />
import { Component, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { NgbActiveModal, NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { FormControl, FormGroup, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../../shared/form-directives';

import { OibCodeBlockComponent } from '../../../shared/form/oib-code-block/oib-code-block.component';
import { OibScanModeComponent } from '../../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { FormComponent } from '../../../shared/form/form.component';
import { TransformerCommandDTO, TransformerDTO } from '../../../../../../shared/model/transformer.model';

@Component({
  selector: 'oib-edit-transformer-modal',
  templateUrl: './edit-transformer-modal.component.html',
  styleUrl: './edit-transformer-modal.component.scss',
  imports: [
    ...formDirectives,
    TranslateModule,
    SaveButtonComponent,
    OibCodeBlockComponent,
    OibScanModeComponent,
    NgbTypeahead,
    FormComponent
  ],
  standalone: true
})
export class EditTransformerModalComponent implements AfterViewInit, OnDestroy {
  @ViewChild(OibCodeBlockComponent) editor: OibCodeBlockComponent | null = null;
  mode: 'create' | 'edit' = 'create';
  state = new ObservableState();

  inputType: string | null = null;
  outputType: string | null = null;

  form: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string | null>;
    code: FormControl<string>;
    fileRegex: FormControl<string | null>;
  }> | null = null;

  private diagnosticCodesToIgnore = [
    7006 // Parameter 'foo' implicitly has an 'any' type.(7006)
  ];

  constructor(
    private modal: NgbActiveModal,
    private fb: NonNullableFormBuilder
  ) {}

  ngAfterViewInit() {
    if (this.editor) {
      this.editor.registerOnLoaded(() => {
        if (!monaco) {
          return;
        }

        // The initial editor is created as a JavaScript editor
        // and in order to have type safety checks (like in TypeScript)
        // but without enabling TypeScript language features, we have to replace the model
        // source: https://github.com/Microsoft/monaco-editor/issues/989#issuecomment-411027528

        // Make sure the language is TS and the file is JS
        const uri = monaco.Uri.parse('index.js');
        const model = monaco.editor.createModel('', 'typescript', uri);
        this.editor?.replaceModel(model);

        const compilerOptions = monaco.languages.typescript.typescriptDefaults.getCompilerOptions();
        compilerOptions.allowJs = true;
        compilerOptions.checkJs = true;
        compilerOptions.strict = true;
        // supported version for node 18, CHANGE THIS IF BACKEND NODE VERSION CHANGES
        compilerOptions.lib = ['es2022'];
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);

        // Ignore certain error codes
        monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
          diagnosticCodesToIgnore: this.diagnosticCodesToIgnore
        });

        // Add extra types annotations that will be available globally
        monaco.languages.typescript.typescriptDefaults.setExtraLibs([{ content: this.extraLib }]);

        this.editor?.writeValue(this.form!.value.code || this.defaultCode);
      });
    }
  }

  ngOnDestroy() {
    // When the modal is closed dispose the created model
    const currentModel = this.editor?.codeEditorInstance?.getModel();
    currentModel?.dispose();
  }

  private createForm(transformer: TransformerDTO | null) {
    this.form = this.fb.group({
      name: this.fb.control('', { validators: Validators.required }),
      description: this.fb.control<string | null>(null),
      code: this.fb.control('', { validators: Validators.required, asyncValidators: this.isCodeValid.bind(this) }),
      fileRegex: this.fb.control<string | null>(null)
    });

    // if we have an item we initialize the values
    if (transformer) {
      this.form.patchValue(transformer);
    } else {
      this.form.setValue(this.form.getRawValue());
    }
  }

  /**
   * Prepares the component for creation.
   */
  prepareForCreation(inputType: string, outputType: string) {
    this.mode = 'create';
    this.inputType = inputType;
    this.outputType = outputType;
    this.createForm(null);
  }

  /**
   * Prepares the component for edition.
   */
  prepareForEdition(transformer: TransformerDTO) {
    this.mode = 'edit';
    this.inputType = transformer.inputType;
    this.outputType = transformer.outputType;
    this.createForm(transformer);
  }

  cancel() {
    this.modal.dismiss();
  }

  save() {
    if (!this.form!.valid) {
      return;
    }

    const formValue = this.form!.value;

    const command: TransformerCommandDTO = {
      name: formValue.name!,
      description: formValue.description ?? null,
      inputType: this.inputType!,
      outputType: this.outputType!,
      code: formValue.code!,
      fileRegex: formValue.fileRegex ?? null
    };

    this.modal.close(command);
  }

  async isCodeValid(): Promise<ValidationErrors | null> {
    if (!window.monaco) {
      return null;
    }

    const model = this.editor?.codeEditorInstance?.getModel();
    if (!model) {
      return null;
    }

    const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
    const worker = await getWorker(model.uri);

    const diagnostics = (
      await Promise.all([worker.getSyntacticDiagnostics(model.uri.toString()), worker.getSemanticDiagnostics(model.uri.toString())])
    ).reduce((arr, current) => arr.concat(current));

    const errors = diagnostics.filter(diagnostic => !this.diagnosticCodesToIgnore.includes(diagnostic.code));
    return errors.length === 0 ? null : { transformerCodeError: true };
  }

  private extraLib = `
      interface BaseOIBusContent {
        type: string;
      }

      interface OIBusTimeValue {
        pointId: string;
        timestamp: string;
        data: {
          value: string | number;
          [key: string]: any;
        };
      }

      // OIBusTimeValueContent is currently called OIBusDataValue
      interface OIBusTimeValueContent extends BaseOIBusContent {
        type: 'time-values';
        content: Array<OIBusTimeValue>;
      }

      interface OIBusRawContent extends BaseOIBusContent {
        type: 'raw';
        filePath: string;
      }

      interface GeneralReturnType<TType = string> {
        type: TType;
        data: any;
      };
    `;

  private inputTypeMap = new Map([
    ['time-values', 'OIBusTimeValueContent'],
    ['raw', 'OIBusRawContent']
  ]);

  private get defaultCode() {
    const inputDataType = this.inputTypeMap?.get(this.inputType!) ?? '';

    // This code is formatted weirdly here, in order to not add unnecessary spaces in the UI
    return `/**
  * Transformer function implementation.
  * You may use other helper functions, but this one will be called by the engine.
  *
  * @param   {${inputDataType}} inputData  South output
  * @returns {Promise<GeneralReturnType<'${this.outputType}'>>}  North input
  */
async function transform(inputData) {
    // Your code here ...

    return {
        type: '${this.outputType}',
        data: ''
    };
}
`;
  }
}
