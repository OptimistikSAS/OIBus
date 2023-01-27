import { Component, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { formDirectives } from '../../shared/form-directives';
import { NgForOf } from '@angular/common';
import { NorthConnectorDTO, NorthType } from '../../model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { SouthConnectorDTO, SouthType } from '../../model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { combineLatest } from 'rxjs';
import { NonNullableFormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'oib-create-history-query-modal',
  templateUrl: './create-history-query-modal.component.html',
  styleUrls: ['./create-history-query-modal.component.scss'],
  imports: [...formDirectives, TranslateModule, NgForOf],
  standalone: true
})
export class CreateHistoryQueryModalComponent implements OnInit {
  northTypes: Array<NorthType> = [];
  northList: Array<NorthConnectorDTO> = [];
  southTypes: Array<SouthType> = [];
  southList: Array<SouthConnectorDTO> = [];

  createForm = this.fb.group({
    newSouth: this.fb.control(false),
    newNorth: this.fb.control(false),
    southType: this.fb.control(null as string | null, Validators.required),
    northType: this.fb.control(null as string | null, Validators.required),
    southId: this.fb.control(null as string | null),
    northId: this.fb.control(null as string | null)
  });
  constructor(
    private modal: NgbActiveModal,
    private northConnectorService: NorthConnectorService,
    private southConnectorService: SouthConnectorService,
    private fb: NonNullableFormBuilder
  ) {
    this.createForm.controls.newNorth.valueChanges.subscribe(value => {
      if (value) {
        this.createForm.controls.northId.disable();
      } else {
        this.createForm.controls.northId.enable();
      }
    });
    this.createForm.controls.newSouth.valueChanges.subscribe(value => {
      if (value) {
        this.createForm.controls.southId.disable();
      } else {
        this.createForm.controls.southId.enable();
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
      if (this.southTypes.length === 0) {
        this.createForm.controls.newSouth.setValue(true);
        this.createForm.controls.newSouth.disable();
      }
      if (this.northList.length === 0) {
        this.createForm.controls.newNorth.setValue(true);
        this.createForm.controls.newNorth.disable();
      }
    });
  }

  create() {
    if (!this.createForm.valid) {
      return;
    }

    const formValues = this.createForm.value;
    const queryParams = {
      northType: formValues.northType,
      southType: formValues.southType
    };
    this.modal.close(queryParams);
  }

  cancel() {
    this.modal.dismiss();
  }
}
