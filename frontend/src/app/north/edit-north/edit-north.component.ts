import { Component, OnInit } from '@angular/core';
import { NgForOf, NgIf } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { formDirectives } from '../../shared/form-directives';
import { FormControl, FormGroup, NonNullableFormBuilder, Validators } from '@angular/forms';
import { NotificationService } from '../../shared/notification.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, Observable, of, switchMap, tap } from 'rxjs';
import { FormComponent } from '../../shared/form/form.component';
import { OibFormControl } from '../../../../../shared/model/form.model';
import { ScanModeDTO } from '../../../../../shared/model/scan-mode.model';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { ScanModeService } from '../../services/scan-mode.service';
import { ProxyService } from '../../services/proxy.service';
import { NorthConnectorCommandDTO, NorthConnectorDTO, NorthConnectorManifest } from '../../../../../shared/model/north-connector.model';
import { NorthConnectorService } from '../../services/north-connector.service';
import { OibScanModeComponent } from '../../shared/form/oib-scan-mode/oib-scan-mode.component';
import { createFormGroup, groupFormControlsByRow } from '../../shared/form-utils';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';
import { BoxComponent, BoxTitleDirective } from '../../shared/box/box.component';

@Component({
  selector: 'oib-edit-north',
  standalone: true,
  imports: [
    NgIf,
    NgForOf,
    TranslateModule,
    ...formDirectives,
    RouterLink,
    SaveButtonComponent,
    FormComponent,
    OibScanModeComponent,
    BackNavigationDirective,
    BoxComponent,
    BoxTitleDirective
  ],
  templateUrl: './edit-north.component.html',
  styleUrls: ['./edit-north.component.scss']
})
export class EditNorthComponent implements OnInit {
  mode: 'create' | 'edit' = 'create';
  northConnector: NorthConnectorDTO | null = null;
  northType = '';
  state = new ObservableState();
  loading = true;
  northSettingsControls: Array<Array<OibFormControl>> = [];
  scanModes: Array<ScanModeDTO> = [];
  proxies: Array<ProxyDTO> = [];
  manifest: NorthConnectorManifest | null = null;

  northForm: FormGroup<{
    name: FormControl<string>;
    description: FormControl<string>;
    enabled: FormControl<boolean>;
    caching: FormGroup<{
      scanModeId: FormControl<string | null>;
      retryInterval: FormControl<number>;
      retryCount: FormControl<number>;
      groupCount: FormControl<number>;
      maxSendCount: FormControl<number>;
      sendFileImmediately: FormControl<boolean>;
      maxSize: FormControl<number>;
    }>;
    archive: FormGroup<{
      enabled: FormControl<boolean>;
      retentionDuration: FormControl<number>;
    }>;
    settings: FormGroup;
  }> | null = null;

  constructor(
    private northConnectorService: NorthConnectorService,
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private scanModeService: ScanModeService,
    private proxyService: ProxyService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    combineLatest([this.proxyService.list(), this.scanModeService.list(), this.route.paramMap, this.route.queryParamMap])
      .pipe(
        switchMap(([proxies, scanModes, params, queryParams]) => {
          this.proxies = proxies;
          this.scanModes = scanModes.filter(scanMode => scanMode.id !== 'subscription');
          let paramNorthId = params.get('northId');
          this.northType = queryParams.get('type') || '';
          // if there is a North ID, we are editing a North connector
          if (paramNorthId) {
            this.mode = 'edit';
          } else {
            // fetch the North connector in case of duplicate
            paramNorthId = queryParams.get('duplicate');
          }

          if (paramNorthId) {
            return this.northConnectorService.getNorthConnector(paramNorthId).pipe(this.state.pendingUntilFinalization());
          }
          // otherwise, we are creating one
          return of(null);
        }),
        switchMap(northConnector => {
          this.northConnector = northConnector;
          if (northConnector) {
            this.northType = northConnector.type;
          }

          return combineLatest([of(northConnector), this.northConnectorService.getNorthConnectorTypeManifest(this.northType)]);
        })
      )
      .subscribe(([northConnector, manifest]) => {
        if (!manifest) {
          this.loading = false;
          return;
        }

        this.northSettingsControls = groupFormControlsByRow(manifest.settings);

        this.northForm = this.fb.group({
          name: ['', Validators.required],
          description: '',
          enabled: true as boolean,
          settings: createFormGroup(manifest.settings, this.fb),
          caching: this.fb.group({
            scanModeId: this.fb.control<string | null>(null, Validators.required),
            retryInterval: [5000, Validators.required],
            retryCount: [3, Validators.required],
            groupCount: [1000, Validators.required],
            maxSendCount: [10_000, Validators.required],
            sendFileImmediately: true as boolean,
            maxSize: [0, Validators.required]
          }),
          archive: this.fb.group({
            enabled: [false, Validators.required],
            retentionDuration: [720, Validators.required]
          })
        });

        // if we have a south connector we initialize the values
        if (northConnector) {
          this.northForm.patchValue(northConnector);
        }

        this.manifest = manifest;
        this.loading = false;
      });
  }

  createOrUpdateNorthConnector(command: NorthConnectorCommandDTO): void {
    let createOrUpdate: Observable<NorthConnectorDTO>;
    // if we are editing
    if (this.mode === 'edit') {
      createOrUpdate = this.northConnectorService.updateNorthConnector(this.northConnector!.id, command).pipe(
        tap(() => this.notificationService.success('north.updated', { name: command.name })),
        switchMap(() => this.northConnectorService.getNorthConnector(this.northConnector!.id))
      );
    } else {
      createOrUpdate = this.northConnectorService
        .createNorthConnector(command)
        .pipe(tap(() => this.notificationService.success('north.created', { name: command.name })));
    }
    createOrUpdate.pipe(this.state.pendingUntilFinalization()).subscribe(northConnector => {
      this.router.navigate(['/north', northConnector.id]);
    });
  }

  save() {
    if (!this.northForm!.valid) {
      return;
    }

    const formValue = this.northForm!.value;

    const command: NorthConnectorCommandDTO = {
      name: formValue.name!,
      type: this.northType,
      description: formValue.description!,
      enabled: formValue.enabled!,
      settings: formValue.settings!,
      caching: {
        scanModeId: formValue.caching!.scanModeId!,
        retryInterval: formValue.caching!.retryInterval!,
        retryCount: formValue.caching!.retryCount!,
        groupCount: formValue.caching!.groupCount!,
        maxSendCount: formValue.caching!.maxSendCount!,
        sendFileImmediately: formValue.caching!.sendFileImmediately!,
        maxSize: formValue.caching!.maxSize!
      },
      archive: {
        enabled: formValue.archive!.enabled!,
        retentionDuration: formValue.archive!.retentionDuration!
      }
    };
    this.createOrUpdateNorthConnector(command);
  }
}
