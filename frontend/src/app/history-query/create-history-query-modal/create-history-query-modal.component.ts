import { Component, inject, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';

import { NorthConnectorLightDTO, NorthType } from '../../../../../backend/shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorLightDTO, SouthType } from '../../../../../backend/shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { combineLatest } from 'rxjs';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';

@Component({
  selector: 'oib-create-history-query-modal',
  templateUrl: './create-history-query-modal.component.html',
  styleUrl: './create-history-query-modal.component.scss',
  imports: [...formDirectives, TranslateModule, SaveButtonComponent],
  standalone: true
})
export class CreateHistoryQueryModalComponent implements OnInit {
  private modal = inject(NgbActiveModal);
  private northConnectorService = inject(NorthConnectorService);
  private southConnectorService = inject(SouthConnectorService);

  northTypes: Array<NorthType> = [];
  northList: Array<NorthConnectorLightDTO> = [];
  southTypes: Array<SouthType> = [];
  southList: Array<SouthConnectorLightDTO> = [];
  state = new ObservableState();

  createForm = inject(NonNullableFormBuilder).group({
    fromExistingSouth: true,
    fromExistingNorth: true,
    southType: [null as string | null, Validators.required],
    northType: [null as string | null, Validators.required],
    southId: [null as string | null, Validators.required],
    northId: [null as string | null, Validators.required]
  });

  constructor() {
    this.createForm.controls.southType.disable();
    this.createForm.controls.northType.disable();

    this.createForm.controls.fromExistingNorth.valueChanges.subscribe(value => {
      if (value) {
        this.createForm.controls.northId.enable();
        this.createForm.controls.northType.disable();
      } else {
        this.createForm.controls.northId.disable();
        this.createForm.controls.northType.enable();
      }
    });
    this.createForm.controls.fromExistingSouth.valueChanges.subscribe(value => {
      if (value) {
        this.createForm.controls.southId.enable();
        this.createForm.controls.southType.disable();
      } else {
        this.createForm.controls.southId.disable();
        this.createForm.controls.southType.enable();
      }
    });
  }

  ngOnInit() {
    combineLatest([
      this.northConnectorService.getNorthConnectorTypes(),
      this.northConnectorService.list(),
      this.southConnectorService.getAvailableTypes(),
      this.southConnectorService.list()
    ]).subscribe(([northTypes, northList, southTypes, southList]) => {
      this.northTypes = northTypes;
      this.northList = northList;
      this.southTypes = southTypes.filter(southManifest => {
        // Keep only South with history mode supported
        return southManifest.modes.history;
      });
      this.southList = southList.filter(south => {
        // Keep only South with history mode supported
        const southType = southTypes.find(manifest => manifest.id === south.type);
        return southType && southType.modes.history;
      });
      if (this.southList.length === 0) {
        this.createForm.controls.fromExistingSouth.setValue(false);
        this.createForm.controls.fromExistingSouth.disable();
      }
      if (this.northList.length === 0) {
        this.createForm.controls.fromExistingNorth.setValue(false);
        this.createForm.controls.fromExistingNorth.disable();
      }
    });
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
