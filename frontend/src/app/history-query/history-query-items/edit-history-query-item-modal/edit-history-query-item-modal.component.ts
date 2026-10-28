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

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, startWith } from 'rxjs';

import { HistoryQueryItemCommandDTO, HistoryQueryItemDTO } from '@oibus/shared/api/history-query.model';
import { SouthConnectorCommandDTO } from '@oibus/shared/api/south-connector.model';
import { HistoryTransformerDTOWithOptions } from '@oibus/shared/api/transformer.model';
import { OIBusObjectAttribute } from '@oibus/shared/connector/form.model';
import { SouthConnectorManifest } from '@oibus/shared/connector/south-manifest.model';

import { addAttributeToForm, addEnablingConditions, extractFormValue } from '../../../shared/form/dynamic-form.builder';
import { EnabledSelectorComponent } from '../../../shared/form/enabled-selector/enabled-selector.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../../shared/form/form-validation-directives';
import { OIBUS_FORM_MODE } from '../../../shared/form/oibus-form-mode.token';
import { OIBusObjectFormControlComponent } from '../../../shared/form/oibus-object-form-control/oibus-object-form-control.component';
import { OIBusSettingsSummaryComponent } from '../../../shared/form/oibus-settings-summary/oibus-settings-summary.component';
import { summarizeSettings } from '../../../shared/form/oibus-settings-summary/settings-summary';
import { ModalStepsComponent } from '../../../shared/modal-steps/modal-steps.component';
import { submitsOnEnter } from '../../../shared/modal-steps/wizard-steps';
import { ObservableState, SaveButtonComponent } from '../../../shared/save-button/save-button.component';
import { UnsavedChangesConfirmationService } from '../../../shared/unsaved-changes-confirmation.service';
import {
  countItemChanges,
  HISTORY_ITEM_MODAL_STEPS,
  HistoryItemModalStep,
  ItemModalSteps,
  ItemSummary
} from '../../../south/south-items/item-modal-steps';
import SouthItemTestComponent from '../../../south/south-items/south-item-test/south-item-test.component';

type ItemForm = FormGroup<{
  name: FormControl<string>;
  enabled: FormControl<boolean>;
  settings: FormGroup;
}>;

@Component({
  selector: 'oib-edit-history-query-item-modal',
  templateUrl: './edit-history-query-item-modal.component.html',
  styleUrl: './edit-history-query-item-modal.component.scss',
  imports: [
    EnabledSelectorComponent,
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    SouthItemTestComponent,
    OI_FORM_VALIDATION_DIRECTIVES,
    OIBusObjectFormControlComponent,
    SaveButtonComponent,
    ModalStepsComponent,
    OIBusSettingsSummaryComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    {
      provide: OIBUS_FORM_MODE,
      useFactory: (component: EditHistoryQueryItemModalComponent) => () => (component.mode() === 'edit' ? 'edit' : 'create'),
      deps: [forwardRef(() => EditHistoryQueryItemModalComponent)]
    }
  ]
})
export class EditHistoryQueryItemModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  readonly mode = signal<'create' | 'edit' | 'copy'>('create');
  /** True when opened from history-query-detail (saves directly to API); false when opened from edit-history-query (changes are applied in-memory). */
  readonly directSave = signal(true);
  /**
   * Set when a new item is saved with "save and add another": the opener then opens the modal again for the next item,
   * from the one just saved (see prepareForCreation).
   */
  addAnother = false;
  /**
   * Set by edit-history-query (in-memory editing) to the history query's current, possibly-unsaved
   * transformer list, so the item-test panel offers them instead of fetching the last-saved state.
   * Left null when opened from history-query-detail, where a fetch is already accurate.
   */
  readonly inMemoryTransformers = signal<Array<HistoryTransformerDTOWithOptions> | null>(null);
  readonly state = new ObservableState();
  readonly historyId = signal('');
  readonly fromSouth = signal<string | null>(null);
  readonly southConnectorCommand = signal<SouthConnectorCommandDTO | null>(null);
  readonly manifest = signal<SouthConnectorManifest | null>(null);
  private item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO | null = null;
  /** The item added just before, in a row of new items: the new one starts enabled or not like it */
  private previousItem: HistoryQueryItemCommandDTO | null = null;
  private itemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO> = [];

  /** Not every item passed will have an id, but we still need to check for uniqueness.
   * This ensures that we have a backup identifier for the currently edited item.
   * In 'copy' and 'create' cases, we always check all items' names
   */
  private tableIndex: number | null = null;

  readonly form = signal<ItemForm | null>(null);
  private readonly formValue = signal<ItemForm['value'] | null>(null);
  /** The last change of the form (value, status, touched...) */
  private readonly formEvent = signal<unknown>(null);

  readonly steps = new ItemModalSteps(HISTORY_ITEM_MODAL_STEPS, step => this.stepControls(step), this.formEvent);
  /** A new item is saved from the last step, an edited or copied one from any step */
  readonly canSave = computed(() => this.mode() !== 'create' || this.steps.isLast());

  /** The item as summed up in the Review step */
  readonly reviewSummary = computed<ItemSummary>(() => {
    this.formEvent();
    this.formValue();
    return this.summarizeItem();
  });
  /** The item as it was when opened for edition, to show what changed in the Review step: null for a new item */
  readonly savedSummary = signal<ItemSummary | null>(null);
  /** How many settings changed since the item was saved: null for a new item */
  readonly changeCount = computed(() => {
    const saved = this.savedSummary();
    return saved ? countItemChanges(this.reviewSummary(), saved) : null;
  });

  /** The item built from the form, tested by the item-test panel and returned when saving. */
  readonly formItem = computed<HistoryQueryItemCommandDTO | null>(() => {
    const formValue = this.formValue();
    if (!formValue) {
      return null;
    }
    return {
      id: this.item?.id ?? `temp_${Date.now()}`,
      enabled: formValue.enabled!,
      name: formValue.name!,
      settings: extractFormValue(formValue.settings)
    };
  });

  readonly itemSettingsAttribute = computed(() => {
    const manifest = this.manifest();
    return manifest ? (manifest.items.rootAttribute.attributes.find(element => element.key === 'settings') as OIBusObjectAttribute) : null;
  });

  /**
   * Prepares the component for creation.
   * @param itemList the items of the history query, the one added just before included
   * @param previousItem the item added just before with "save and add another", whose shared settings the new one starts with
   */
  prepareForCreation(
    itemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    historyId: string,
    fromSouth: string | null,
    southConnectorCommand: SouthConnectorCommandDTO,
    manifest: SouthConnectorManifest,
    previousItem: HistoryQueryItemCommandDTO | null = null
  ) {
    this.mode.set('create');
    this.previousItem = previousItem;
    this.manifest.set(manifest);
    this.historyId.set(historyId);
    this.fromSouth.set(fromSouth);
    this.southConnectorCommand.set(southConnectorCommand);
    this.itemList = itemList;
    this.buildForm();
  }

  prepareForEdition(
    itemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    historyQueryItem: HistoryQueryItemDTO | HistoryQueryItemCommandDTO,
    historyId: string,
    fromSouth: string | null,
    southConnectorCommand: SouthConnectorCommandDTO,
    manifest: SouthConnectorManifest,
    tableIndex: number
  ) {
    this.mode.set('edit');
    this.manifest.set(manifest);
    this.historyId.set(historyId);
    this.fromSouth.set(fromSouth);
    this.southConnectorCommand.set(southConnectorCommand);
    this.itemList = itemList;
    this.item = historyQueryItem; // used to check uniqueness
    this.tableIndex = tableIndex;
    this.buildForm();
  }

  prepareForCopy(
    itemList: Array<HistoryQueryItemDTO | HistoryQueryItemCommandDTO>,
    item: HistoryQueryItemDTO | HistoryQueryItemCommandDTO,
    historyId: string,
    fromSouth: string | null,
    southConnectorCommand: SouthConnectorCommandDTO,
    manifest: SouthConnectorManifest
  ) {
    this.mode.set('copy');
    this.manifest.set(manifest);
    this.historyId.set(historyId);
    this.fromSouth.set(fromSouth);
    this.southConnectorCommand.set(southConnectorCommand);
    this.itemList = itemList;
    // used to check uniqueness
    this.item = { ...structuredClone(item), name: `${item.name}-copy`, id: '' };
    this.buildForm();
  }

  canDismiss(): Observable<boolean> | boolean {
    if (this.form()?.dirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  cancel() {
    this.modal.dismiss();
  }

  /** Pressing Enter in a field submits the form, whether the Save button shows or not */
  onEnter(event: Event) {
    if (submitsOnEnter(event)) {
      event.preventDefault();
      this.submit();
    }
  }

  /** Submitting the form (e.g. pressing Enter) saves the item once it can be, and opens the next step before. */
  submit() {
    if (this.canSave()) {
      this.save();
    } else {
      this.steps.next();
    }
  }

  /** @param addAnother true to open the modal again for a new item once this one is saved */
  save(addAnother = false) {
    if (!this.form()!.valid) {
      this.steps.showFirstInvalid();
      return;
    }
    this.addAnother = addAnother;
    this.modal.close(this.formItem());
  }

  /** The controls edited in each step */
  private stepControls(step: HistoryItemModalStep): Array<AbstractControl> {
    const form = this.form();
    if (!form) {
      return [];
    }
    switch (step) {
      case 'general':
        return [form.controls.name, form.controls.enabled];
      case 'settings':
        return [form.controls.settings];
      case 'review':
        return [];
    }
  }

  private checkUniqueness(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      let names!: Array<string>;

      switch (this.mode()) {
        case 'copy':
        case 'create':
          names = this.itemList.map(item => item.name);
          break;
        case 'edit':
          // Saved items are identified by id; unsaved (in-memory) ones only by their position in itemList
          if (this.item!.id) {
            names = this.itemList.filter(item => item.id !== this.item!.id).map(item => item.name);
          } else {
            names = this.itemList.filter((_, index) => index !== this.tableIndex).map(item => item.name);
          }
          break;
      }

      return names.includes(control.value) ? { mustBeUnique: true } : null;
    };
  }

  private buildForm() {
    const form = this.fb.group({
      name: ['', [Validators.required, this.checkUniqueness()]],
      enabled: [true, Validators.required],
      settings: this.fb.group({})
    });

    const settingsAttribute = this.itemSettingsAttribute()!;
    for (const attribute of settingsAttribute.attributes) {
      addAttributeToForm(this.fb, form.controls.settings, attribute);
    }
    addEnablingConditions(form.controls.settings, settingsAttribute.enablingConditions);

    // if we have an item, we initialize the values
    if (this.item) {
      form.patchValue(this.item);
    } else {
      // An item added after another one starts enabled or not like it, but with neither its name nor its connector
      // settings, which tell the items apart
      form.setValue({ ...form.getRawValue(), enabled: this.previousItem?.enabled ?? true });
    }
    form.valueChanges
      .pipe(startWith(form.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(formValue => this.formValue.set(formValue));
    form.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => this.formEvent.set(event));
    this.form.set(form);
    this.savedSummary.set(this.mode() === 'edit' ? this.summarizeItem() : null);
  }

  /** The item as currently edited, summed up: see `reviewSummary` */
  private summarizeItem(): ItemSummary {
    const form = this.form();
    const item = this.formItem();
    if (!form || !item) {
      return { general: [], settings: [] };
    }
    return {
      general: [
        { kind: 'text', labelKey: 'south.items.name', text: item.name || null, invalid: form.controls.name.invalid },
        {
          kind: 'text',
          labelKey: 'south.items.status',
          text: this.translateService.instant(item.enabled ? 'common.enabled' : 'common.disabled')
        }
      ],
      settings: summarizeSettings(this.itemSettingsAttribute()!, item.settings, {
        translateService: this.translateService,
        isInvalid: path => form.controls.settings.get(path)?.invalid ?? false
      })
    };
  }
}
