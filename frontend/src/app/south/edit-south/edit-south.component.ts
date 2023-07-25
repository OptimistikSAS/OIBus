import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SouthConnectorCommandDTO, SouthConnectorDTO, SouthConnectorManifest } from '../../../../../shared/model/south-connector.model';
import { SouthConnectorService } from '../../services/south-connector.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';
import { SouthItemsComponent } from '../south-items/south-items.component';

@Component({
  selector: 'oib-edit-south',
  standalone: true,
  imports: [
    NgIf,
    NgForOf,
    TranslateModule,
    ...formDirectives,
    RouterLink,
    SaveButtonComponent,
    FormComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective,
    SouthItemsComponent
  ],
  templateUrl: './edit-south.component.html',
  styleUrls: ['./edit-south.component.scss']
})
export class EditSouthComponent implements OnInit {
  mode: 'create' | 'edit' = 'create';
  southConnector: SouthConnectorDTO | null = null;
  southType = '';
  state = new ObservableState();

  southSettingsControls: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  manifest: SouthConnectorManifest | null = null;
  southForm: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    history: FormGroup<{
      maxInstantPerItem: FormControl<boolean>;
      maxReadInterval: FormControl<number>;
      readDelay: FormControl<number>;
    }>;
    settings: FormGroup;
  }> | null = null;

  constructor(
    private southConnectorService: SouthConnectorService,
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    combineLatest([this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([scanModes, params, queryParams]) => {
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          let paramSouthId = params.get('southId');
          this.southType = queryParams.get('type') || '';
          // if there is a South ID, we are editing a South connector
          if (paramSouthId) {
            this.mode = 'edit';
          } else {
            // fetch the South connector in case of duplicate
            paramSouthId = queryParams.get('duplicate');
          }

          if (paramSouthId) {
            return this.southConnectorService.get(paramSouthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          return of(null);
        }),
        switchMap(southConnector => {
          this.southConnector = southConnector;
          if (southConnector) {
            this.southType = southConnector.type;
          }
          return combineLatest([of(southConnector), this.southConnectorService.getSouthConnectorTypeManifest(this.southType)]);
        })
      )
      .subscribe(([southConnector, manifest]) => {
        if (!manifest) {
          return;
        }

        this.southSettingsControls = groupFormControlsByRow(manifest.settings);

        this.southForm = this.fb.group({
          name: ['', Validators.required],
          description: '',
          enabled: true as boolean,
          history: this.fb.group({
            maxInstantPerItem: manifest.modes.forceMaxInstantPerItem,
            maxReadInterval: 0,
            readDelay: 200
          }),
          settings: createFormGroup(manifest.settings, this.fb)
        });

        // if we have a south connector we initialize the values
        if (southConnector) {
          this.southForm.patchValue(southConnector);
        } else {
          // we should provoke all value changes to make sure fields are properly hidden and disabled
          this.southForm.setValue(this.southForm.getRawValue());
        }

        this.manifest = manifest;
      });
  }

  createOrUpdateSouthConnector(command: SouthConnectorCommandDTO): void {
    let createOrUpdate: Observable<SouthConnectorDTO>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.southConnectorService.update(this.southConnector!.id, command).pipe(
        tap(() => this.notificationService.success('south.updated', { name: command.name })),
        switchMap(() => this.southConnectorService.get(this.southConnector!.id))
      );
    } else {
      createOrUpdate = this.southConnectorService
        .create(command)
        .pipe(tap(() => this.notificationService.success('south.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(southConnector => {
      if (this.mode === 'create') {
        this.router.navigate(['/south', southConnector.id, 'edit']);
      } else {
        this.router.navigate(['south']);
      }
    });
  }

  submit(value: 'save' | 'test') {
    if (!this.southForm!.valid) {
      return;
    }

    const formValue = this.southForm!.value;
    const command: SouthConnectorCommandDTO = {
      name: formValue.name!,
      type: this.southType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      history: {
        maxInstantPerItem: formValue.history!.maxInstantPerItem!,
        maxReadInterval: formValue.history!.maxReadInterval!,
        readDelay: formValue.history!.readDelay!
      },
      settings: formValue.settings!
    };
    if (value === 'save') {
      this.createOrUpdateSouthConnector(command);
    } else {
      this.southConnectorService
        .testConnection(this.southConnector?.id || 'create', command)
        .pipe(
          catchError(httpError => {
            this.notificationService.error('south.test-connection.failure', { error: httpError.error.message });
            throw httpError;
          })
        )
        .subscribe(() => {
          this.notificationService.success('south.test-connection.success');
        });
    }
  }
}
