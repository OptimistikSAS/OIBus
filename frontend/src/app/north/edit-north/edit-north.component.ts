import { ChangeDetectionStrategy, Component, computed, DestroyRef, forwardRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';

import { CertificateDTO } from '@oibus/shared/api/certificate.model';
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { ScanModeDTO } from '@oibus/shared/api/scan-mode.model';
import { TransformerDTO, TransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { OIBusScanModeAttribute } from '@oibus/shared/connector/form.model';
import { NorthConnectorManifest, OIBusNorthType } from '@oibus/shared/connector/north-manifest.model';

import { CertificateService } from '../../services/certificate.service';
import { NorthConnectorService } from '../../services/north-connector.service';
import { ScanModeService } from '../../services/scan-mode.service';
import { TransformerService } from '../../services/transformer.service';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { DocsUrlService } from '../../shared/docs-url.service';
import { addAttributeToForm, addEnablingConditions, extractFormValue } from '../../shared/form/dynamic-form.builder';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { OIBUS_FORM_MODE } from '../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusScanModeFormControlComponent } from '../../shared/form/oibus-scan-mode-form-control/oibus-scan-mode-form-control.component';
import { OIBusSettingsSummaryComponent } from '../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import {
  compareSettings,
  countChanges,
  SettingSummary,
  summarizeSettings
} from '../../shared/form/oibus-settings-summary/settings-summary';
import { ModalService } from '../../shared/modal.service';
import { ModalStepsComponent } from '../../shared/modal-steps/modal-steps.component';
import { submitsOnEnter, WizardSteps } from '../../shared/modal-steps/wizard-steps';
import { NotificationService } from '../../shared/notification.service';
import { OibHelpComponent } from '../../shared/oib-help/oib-help.component';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { TestConnectionResultModalComponent } from '../../shared/test-connection-result-modal/test-connection-result-modal.component';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { toSourceCommand } from '../../shared/utils/utils';
import { compareLists, formatTransformerSource, summarizeCaching, transformerName } from '../north-summary';
import { NorthTransformersComponent } from '../north-transformers/north-transformers.component';

/** The steps of the north connector page, in order. */
export const NORTH_CONNECTOR_STEPS = ['general', 'settings', 'caching', 'transformers', 'review'] as const;
export type NorthConnectorStep = (typeof NORTH_CONNECTOR_STEPS)[number];

/** The connector as summed up in the Review step */
interface NorthConnectorSummary {
  general: Array<SettingSummary>;
  settings: Array<SettingSummary>;
  caching: Array<SettingSummary>;
  transformers: Array<SettingSummary>;
}

@Component({
  selector: 'oib-edit-north',
  imports: [
    TranslateDirective,
    SaveButtonComponent,
    BackNavigationDirective,
    OibHelpComponent,
    OIBusNorthTypeEnumPipe,
    NorthTransformersComponent,
    ReactiveFormsModule,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusObjectFormControlComponent,
    OIBusScanModeFormControlComponent,
    TranslatePipe,
    ModalStepsComponent,
    OIBusSettingsSummaryComponent
  ],
  templateUrl: './edit-north.component.html',
  styleUrl: './edit-north.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditNorthComponent) => () => component.mode(),
      deps: [forwardRef(() => EditNorthComponent)]
    }
  ]
})
export class EditNorthComponent implements CanComponentDeactivate {
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly scanModeService = inject(ScanModeService);
  private readonly certificateService = inject(CertificateService);
  private readonly transformerService = inject(TransformerService);
  private readonly modalService = inject(ModalService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly docsUrlService = inject(DocsUrlService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly generalSettingsHelpUrl = this.docsUrlService.resolve('guide/north-connectors/common-settings');
  readonly cachingHelpUrl = this.docsUrlService.resolve('guide/north-connectors/common-settings#caching');

  readonly mode = signal<'create' | 'edit'>('create');
  readonly northConnector = signal<NorthConnectorDTO | null>(null);
  readonly northType = signal<OIBusNorthType | null>(null);
  private duplicateId = '';
  readonly state = new ObservableState();
  readonly scanModes = signal<Array<ScanModeDTO>>([]);
  readonly transformers = signal<Array<TransformerDTO>>([]);
  readonly certificates = signal<Array<CertificateDTO>>([]);
  readonly manifest = signal<NorthConnectorManifest | null>(null);
  private existingNorthConnectors: Array<NorthConnectorLightDTO> = [];

  // built once, right before `manifest` is set
  readonly form = signal<FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    caching: FormGroup<{
      trigger: FormGroup<{
        scanMode: FormControl<ScanModeDTO | null>;
        numberOfElements: FormControl<number>;
        numberOfFiles: FormControl<number>;
      }>;
      throttling: FormGroup<{
        runMinDelay: FormControl<number>;
        maxSize: FormControl<number>;
        maxNumberOfElements: FormControl<number>;
      }>;
      error: FormGroup<{
        retryInterval: FormControl<number>;
        retryCount: FormControl<number>;
        retentionDuration: FormControl<number>;
      }>;
      archive: FormGroup<{
        enabled: FormControl<boolean>;
        retentionDuration: FormControl<number>;
      }>;
    }>;
    settings: FormGroup;
  }> | null>(null);

  /** The last change of the form (value, status, touched...) */
  private readonly formEvent = signal<unknown>(null);

  readonly steps = new WizardSteps<NorthConnectorStep>(NORTH_CONNECTOR_STEPS, step => this.stepControls(step), this.formEvent);
  /** A new connector is saved from the last step, an edited one from any step */
  readonly canSave = computed(() => this.mode() === 'edit' || this.steps.isLast());

  /** The transformers of the connector, edited in memory and saved along with the connector */
  private readonly inMemoryTransformersWithOptions = signal<Array<TransformerDTOWithOptions>>([]);

  /** The connector as summed up in the Review step */
  readonly reviewSummary = computed<NorthConnectorSummary>(() => {
    this.formEvent();
    this.inMemoryTransformersWithOptions();
    return this.summarizeConnector();
  });
  /** The connector as it was when opened for edition, to show what changed in the Review step: null for a new one */
  readonly savedSummary = signal<NorthConnectorSummary | null>(null);
  /** The transformers as they were when the connector was opened for edition */
  private readonly savedTransformers = signal<Array<TransformerDTOWithOptions>>([]);
  /** What changed in the transformers since the connector was saved: null for a new connector */
  readonly transformerChanges = computed(() =>
    this.savedSummary() ? compareLists(this.inMemoryTransformersWithOptions(), this.savedTransformers()) : null
  );
  /** How many settings and transformers changed since the connector was saved: null for a new connector */
  readonly changeCount = computed(() => {
    const saved = this.savedSummary();
    const transformerChanges = this.transformerChanges();
    if (!saved || !transformerChanges) {
      return null;
    }
    const summary = this.reviewSummary();
    return (
      countChanges(compareSettings(summary.general, saved.general)) +
      countChanges(compareSettings(summary.settings, saved.settings)) +
      countChanges(compareSettings(summary.caching, saved.caching)) +
      transformerChanges.added +
      transformerChanges.changed +
      transformerChanges.removed
    );
  });

  readonly scanModeAttribute: OIBusScanModeAttribute = {
    type: 'scan-mode',
    key: 'scanMode',
    translationKey: 'north.caching.trigger.schedule',
    acceptableType: 'POLL',
    validators: [{ type: 'REQUIRED', arguments: [] }],
    displayProperties: {
      row: 0,
      columns: 4,
      displayInViewMode: true
    }
  };

  constructor() {
    combineLatest([
      this.scanModeService.list(),
      this.certificateService.list(),
      this.transformerService.list(),
      this.northConnectorService.list(),
      this.route.paramMap,
      this.route.queryParamMap
    ])
      .pipe(
        switchMap(([scanModes, certificates, transformers, northConnectors, params, queryParams]) => {
          this.scanModes.set(scanModes.filter(scanMode => scanMode.id !== 'subscription'));
          this.certificates.set(certificates);
          this.transformers.set(transformers);
          this.existingNorthConnectors = northConnectors;
          const paramNorthId = params.get('northId');
          const duplicateNorthId = queryParams.get('duplicate');
          this.northType.set((queryParams.get('type') as OIBusNorthType) || null);

          // if there is a North ID, we are editing a North connector
          if (paramNorthId) {
            this.mode.set('edit');
            return this.northConnectorService.findById(paramNorthId).pipe(this.state.pendingUntilFinalization());
          }
          // fetch the North connector in case of duplicate
          else if (duplicateNorthId) {
            this.mode.set('create');
            this.duplicateId = duplicateNorthId;
            return this.northConnectorService.findById(duplicateNorthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          else {
            this.mode.set('create');
            return of(null);
          }
        }),
        switchMap(northConnector => {
          this.northConnector.set(northConnector);
          if (northConnector) {
            this.northType.set(northConnector.type);
          }
          return this.northConnectorService.getNorthManifest(this.northType()!);
        }),
        takeUntilDestroyed()
      )
      .subscribe(manifest => {
        if (!manifest) {
          return;
        }
        this.buildForm(manifest);
        this.manifest.set(manifest);
        if (this.mode() === 'edit') {
          this.savedSummary.set(this.summarizeConnector());
          this.savedTransformers.set(structuredClone(this.inMemoryTransformersWithOptions()));
        }
      });
  }

  readonly northTypeHelpUrl = computed(() => this.docsUrlService.resolve('guide/north-connectors/' + this.northType()));

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = (control.value ?? '').toString().trim().toLowerCase();
      if (!value) {
        return null;
      }

      const isDuplicate = this.existingNorthConnectors.some(north => {
        const northConnector = this.northConnector();
        if (northConnector && north.id === northConnector.id) {
          return false;
        }
        return north.name.trim().toLowerCase() === value;
      });

      return isDuplicate ? { mustBeUnique: true } : null;
    };
  }

  private buildForm(manifest: NorthConnectorManifest) {
    const form = this.fb.group({
      name: this.fb.control('', {
        validators: [Validators.required, this.checkUniqueness()]
      }),
      description: '',
      enabled: true as boolean,
      settings: this.fb.group({}),
      caching: this.fb.group({
        trigger: this.fb.group({
          scanMode: this.fb.control<ScanModeDTO | null>(null, Validators.required),
          numberOfElements: [1_000, Validators.required],
          numberOfFiles: [1, Validators.required]
        }),
        throttling: this.fb.group({
          runMinDelay: [200, Validators.required],
          maxSize: [0, Validators.required],
          maxNumberOfElements: [10_000, Validators.required]
        }),
        error: this.fb.group({
          retryInterval: [5_000, Validators.required],
          retryCount: [3, Validators.required],
          retentionDuration: [0, Validators.required]
        }),
        archive: this.fb.group({
          enabled: [false, Validators.required],
          retentionDuration: [72, Validators.required]
        })
      })
    });
    for (const attribute of manifest.settings.attributes) {
      addAttributeToForm(this.fb, form.controls.settings, attribute);
    }
    addEnablingConditions(form.controls.settings, manifest.settings.enablingConditions);
    // if we have a north connector, we initialize the values
    const northConnector = this.northConnector();
    if (northConnector) {
      const trigger = northConnector.caching.trigger;
      form.patchValue({
        ...northConnector,
        caching: {
          ...northConnector.caching,
          // use the scan mode of the list, to have the same ref (the fetched connector is not mutated)
          trigger: { ...trigger, scanMode: this.scanModes().find(element => element.id === trigger.scanMode.id)! }
        }
      });
      // Initialize in-memory transformers for edit mode to allow deferring persistence
      this.inMemoryTransformersWithOptions.set([...northConnector.transformers]);
    } else {
      // we should provoke all value changes to make sure fields are properly hidden and disabled
      form.setValue(form.getRawValue());
    }

    form.controls.name.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    form.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => this.formEvent.set(event));
    this.form.set(form);
  }

  canDeactivate(): Observable<boolean> | boolean {
    if (this.form()?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  createOrUpdateNorthConnector(command: NorthConnectorCommandDTO): void {
    let createOrUpdate: Observable<NorthConnectorDTO>;
    if (this.mode() === 'edit') {
      createOrUpdate = this.northConnectorService.update(this.northConnector()!.id, command).pipe(
        tap(() => {
          this.notificationService.success('north.updated', { name: command.name });
          this.form()?.markAsPristine();
        }),
        switchMap(() => this.northConnectorService.findById(this.northConnector()!.id))
      );
    } else {
      createOrUpdate = this.northConnectorService.create(command, this.duplicateId).pipe(
        tap(() => {
          this.notificationService.success('north.created', { name: command.name });
          this.form()?.markAsPristine();
        })
      );
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(northConnector => {
      this.router.navigate(['/north', northConnector.id]);
    });
  }

  /** Pressing Enter in a field submits the form, whether the Save button shows or not */
  onEnter(event: Event) {
    if (submitsOnEnter(event)) {
      event.preventDefault();
      this.submitStep();
    }
  }

  /** Submitting the form (e.g. pressing Enter) saves the connector once it can be, and opens the next step before. */
  submitStep() {
    if (this.canSave()) {
      this.submit('save');
    } else {
      this.steps.next();
    }
  }

  /** The controls edited in each step */
  private stepControls(step: NorthConnectorStep): Array<AbstractControl> {
    const form = this.form();
    if (!form) {
      return [];
    }
    switch (step) {
      case 'general':
        return [form.controls.name, form.controls.description, form.controls.enabled];
      case 'settings':
        return [form.controls.settings];
      case 'caching':
        return [form.controls.caching];
      case 'transformers':
      case 'review':
        return [];
    }
  }

  submit(value: 'save' | 'test') {
    if (value === 'save') {
      if (!this.form()!.valid) {
        this.steps.showFirstInvalid();
        return;
      }
      this.createOrUpdateNorthConnector(this.formNorthConnectorCommand);
      return;
    }

    // Test: only validate the settings subsection
    const settings = this.form()!.controls.settings;
    settings.markAllAsTouched();
    if (!settings.valid) {
      return;
    }
    const modalRef = this.modalService.open(TestConnectionResultModalComponent);
    const component: TestConnectionResultModalComponent = modalRef.componentInstance;
    component.runTest(
      'north',
      this.northConnector()?.id || null,
      // only the settings are needed (the rest of the form, e.g. the scan mode, may not be filled yet)
      extractFormValue(settings.value)!,
      this.northType() as OIBusNorthType
    );
  }

  updateInMemoryTransformers(transformersWithOptions: Array<TransformerDTOWithOptions> | null) {
    if (transformersWithOptions) {
      this.inMemoryTransformersWithOptions.set(transformersWithOptions);
    } else {
      // When child signals backend update, refresh current connector view and in-memory cache
      this.northConnectorService.findById(this.northConnector()!.id).subscribe(northConnector => {
        this.northConnector.set(JSON.parse(JSON.stringify(northConnector)));
        this.inMemoryTransformersWithOptions.set([...northConnector.transformers]);
      });
    }
  }

  /** The connector as currently edited, summed up: see `reviewSummary` */
  private summarizeConnector(): NorthConnectorSummary {
    const form = this.form();
    const manifest = this.manifest();
    if (!form || !manifest) {
      return { general: [], settings: [], caching: [], transformers: [] };
    }
    const value = form.getRawValue();
    return {
      general: [
        { kind: 'text', labelKey: 'north.name', text: value.name || null, invalid: form.controls.name.invalid },
        { kind: 'text', labelKey: 'north.description', text: value.description || null },
        { kind: 'text', labelKey: 'north.status', text: this.translateService.instant(value.enabled ? 'enabled' : 'disabled') }
      ],
      settings: summarizeSettings(manifest.settings, extractFormValue(form.value.settings), {
        translateService: this.translateService,
        scanModes: this.scanModes(),
        certificates: this.certificates(),
        isInvalid: path => form.controls.settings.get(path)?.invalid ?? false
      }),
      caching: summarizeCaching(value.caching, this.translateService, path => form.controls.caching.get(path)?.invalid ?? false),
      transformers: [
        {
          kind: 'table',
          labelKey: 'north.transformers.title',
          columnKeys: ['north.transformers.source', 'north.transformers.output'],
          rows: this.inMemoryTransformersWithOptions().map(element => [
            formatTransformerSource(element, this.translateService).trim(),
            transformerName(element.transformer, this.translateService)
          ])
        }
      ]
    };
  }

  get formNorthConnectorCommand(): NorthConnectorCommandDTO {
    const formValue = this.form()!.value;
    return {
      name: formValue.name!,
      type: this.northType() as OIBusNorthType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: extractFormValue(formValue.settings)!,
      caching: {
        trigger: {
          scanModeId: formValue.caching!.trigger!.scanMode!.id,
          scanModeName: null,
          numberOfElements: formValue.caching!.trigger!.numberOfElements!,
          numberOfFiles: formValue.caching!.trigger!.numberOfFiles!
        },
        throttling: {
          runMinDelay: formValue.caching!.throttling!.runMinDelay!,
          maxSize: formValue.caching!.throttling!.maxSize!,
          maxNumberOfElements: formValue.caching!.throttling!.maxNumberOfElements!
        },
        error: {
          retryInterval: formValue.caching!.error!.retryInterval!,
          retryCount: formValue.caching!.error!.retryCount!,
          retentionDuration: formValue.caching!.error!.retentionDuration!
        },
        archive: {
          enabled: formValue.caching!.archive!.enabled!,
          retentionDuration: formValue.caching!.archive!.retentionDuration!
        }
      },
      transformers: this.inMemoryTransformersWithOptions().map(element => ({
        id: element.id,
        transformerId: element.transformer.id,
        options: element.options,
        source: toSourceCommand(element.source)
      }))
    };
  }
}
