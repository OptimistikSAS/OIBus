import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { NgForOf, NgIf } from '@angular/common';
import { NorthConnectorDTO, NorthType } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorDTO, SouthType } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { combineLatest } from 'rxjs';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { HistoryQueryService } from '../../services/history-query.service';

@Component({
  selector: 'oib-create-history-query-modal',
  templateUrl: './create-history-query-modal.component.html',
  styleUrls: ['./create-history-query-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, NgForOf, NgIf, SaveButtonComponent],
  standalone: true
})
export class CreateHistoryQueryModalComponent implements OnInit {
  northTypes: Array<NorthType> = [];
  northList: Array<NorthConnectorDTO> = [];
  southTypes: Array<SouthType> = [];
  southList: Array<SouthConnectorDTO> = [];
  state = new ObservableState();

  createForm = this.fb.group({
    name: this.fb.control(null as string | null, Validators.required),
    description: this.fb.control(null as string | null),
    fromExistingSouth: this.fb.control(true),
    fromExistingNorth: this.fb.control(true),
    southType: this.fb.control(null as string | null, Validators.required),
    northType: this.fb.control(null as string | null, Validators.required),
    southId: this.fb.control(null as string | null, Validators.required),
    northId: this.fb.control(null as string | null, Validators.required)
  });
  constructor(
    private modal: NgbActiveModal,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private historyQueryService: HistoryQueryService,
    private fb: NonNullableFormBuilder
  ) {
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
      this.northConnectorService.getNorthConnectors(),
      this.southConnectorService.getSouthConnectorTypes(),
      this.southConnectorService.getSouthConnectors()
    ]).subscribe(([northTypes, northList, southTypes, southList]) => {
      this.northTypes = northTypes;
      this.northList = northList;
      this.southTypes = southTypes.filter(southManifest => {
        // Keep only South with history mode supported
        return southManifest.modes.historyPoint || southManifest.modes.historyFile;
      });
      this.southList = southList.filter(south => {
        // Keep only South with history mode supported
        const southType = southTypes.find(manifest => manifest.type === south.type);
        return southType && (southType.modes.historyPoint || southType.modes.historyFile);
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
    const queryParams = {
      name: formValues.name!,
      description: formValues.description || '',
      northType: formValues.northType || null,
      southType: formValues.southType || null,
      northId: formValues.northId || null,
      southId: formValues.southId || null
    };
    this.historyQueryService
      .createHistoryQuery(queryParams)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(historyQuery => {
        this.modal.close(historyQuery);
      });
  }

  cancel() {
    this.modal.dismiss();
  }
}
