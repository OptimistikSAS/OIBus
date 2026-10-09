import { ChangeDetectionStrategy, Component, computed, inject, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective, TranslatePipe } from '@ngx-translate/core';
import { combineLatest, map, tap } from 'rxjs';

import { NorthConnectorLightDTO } from '@oibus/shared/api/north-connector.model';
import { SouthConnectorLightDTO } from '@oibus/shared/api/south-connector.model';
import { NorthType } from '@oibus/shared/connector/north-manifest.model';
import { SouthType } from '@oibus/shared/connector/south-manifest.model';

import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorService } from '../../services/south-connector.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { OIBusNorthTypeEnumPipe } from '../../shared/oibus-north-type-enum.pipe';
import { OIBusSouthTypeEnumPipe } from '../../shared/oibus-south-type-enum.pipe';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';

@Component({
  selector: 'oib-create-history-query-modal',
  templateUrl: './create-history-query-modal.component.html',
  styleUrl: './create-history-query-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslateDirective,
    TranslatePipe,
    OIBusSouthTypeEnumPipe,
    OIBusNorthTypeEnumPipe,
    OI_FORM_VALIDATION_DIRECTIVES,
    SaveButtonComponent
  ]
})
export class CreateHistoryQueryModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly northConnectorService = inject(NorthConnectorService);
  private readonly southConnectorService = inject(SouthConnectorService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly state = new ObservableState();

  readonly createForm = this.fb.group({
    fromExistingSouth: true,
    fromExistingNorth: true,
    southType: [{ value: null as string | null, disabled: true }, Validators.required],
    northType: [{ value: null as string | null, disabled: true }, Validators.required],
    southId: [null as string | null, Validators.required],
    northId: [null as string | null, Validators.required]
  });

  /** Whether the South/North configurations are imported from existing connectors (also changed when there is none). */
  readonly fromExistingSouth = toSignal(this.createForm.controls.fromExistingSouth.valueChanges, {
    initialValue: this.createForm.controls.fromExistingSouth.value
  });
  readonly fromExistingNorth = toSignal(this.createForm.controls.fromExistingNorth.valueChanges, {
    initialValue: this.createForm.controls.fromExistingNorth.value
  });

  private readonly connectors: Signal<
    | {
        northTypes: Array<NorthType>;
        northList: Array<NorthConnectorLightDTO>;
        southTypes: Array<SouthType>;
        southList: Array<SouthConnectorLightDTO>;
      }
    | undefined
  >;
  readonly northTypes = computed<Array<NorthType>>(() => this.connectors()?.northTypes ?? []);
  readonly northList = computed<Array<NorthConnectorLightDTO>>(() => this.connectors()?.northList ?? []);
  readonly southTypes = computed<Array<SouthType>>(() => this.connectors()?.southTypes ?? []);
  readonly southList = computed<Array<SouthConnectorLightDTO>>(() => this.connectors()?.southList ?? []);

  constructor() {
    this.createForm.controls.fromExistingNorth.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      if (value) {
        this.createForm.controls.northId.enable();
        this.createForm.controls.northType.disable();
      } else {
        this.createForm.controls.northId.disable();
        this.createForm.controls.northType.enable();
      }
    });
    this.createForm.controls.fromExistingSouth.valueChanges.pipe(takeUntilDestroyed()).subscribe(value => {
      if (value) {
        this.createForm.controls.southId.enable();
        this.createForm.controls.southType.disable();
      } else {
        this.createForm.controls.southId.disable();
        this.createForm.controls.southType.enable();
      }
    });

    // loaded once the form reacts to the switches, which are turned off when there is no existing connector
    this.connectors = toSignal(
      combineLatest([
        this.northConnectorService.getNorthTypes(),
        this.northConnectorService.list(),
        this.southConnectorService.getSouthTypes(),
        this.southConnectorService.list()
      ]).pipe(
        map(([northTypes, northList, southTypes, southList]) => ({
          northTypes,
          northList,
          // Keep only South with history mode supported
          southTypes: southTypes.filter(southManifest => southManifest.modes.history),
          southList: southList.filter(south => southTypes.find(manifest => manifest.id === south.type)?.modes.history)
        })),
        tap(({ northList, southList }) => {
          if (southList.length === 0) {
            this.createForm.controls.fromExistingSouth.setValue(false);
            this.createForm.controls.fromExistingSouth.disable();
          }
          if (northList.length === 0) {
            this.createForm.controls.fromExistingNorth.setValue(false);
            this.createForm.controls.fromExistingNorth.disable();
          }
        })
      )
    );
  }

  create() {
    if (!this.createForm.valid) {
      return;
    }

    const formValues = this.createForm.value;
    const queryParams: Record<string, string | null> = {
      northType: formValues.northType || null,
      southType: formValues.southType || null,
      northId: formValues.northId || null,
      southId: formValues.southId || null
    };
    this.modal.close(queryParams);
  }

  cancel() {
    this.modal.dismiss();
  }
}
