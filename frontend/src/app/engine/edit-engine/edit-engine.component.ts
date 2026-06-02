import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TranslateDirective } from '@ngx-translate/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';

import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { BoxComponent } from '../../shared/box/box.component';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { CanComponentDeactivate } from '../../shared/unsaved-changes.guard';
import { UnsavedChangesConfirmationService } from '../../shared/unsaved-changes-confirmation.service';
import { LOG_LEVELS, LogLevel } from '../../../../../backend/shared/model/logs.model';
import { ModalService } from '../../shared/modal.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';

@Component({
  selector: 'oib-edit-engine',
  imports: [ReactiveFormsModule, TranslateDirective, BoxComponent, OI_FORM_VALIDATION_DIRECTIVES, SaveButtonComponent, RouterLink],
  templateUrl: './edit-engine.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './edit-engine.component.scss'
})
export class EditEngineComponent implements OnInit, CanComponentDeactivate {
  private notificationService = inject(NotificationService);
  private engineService = inject(EngineService);
  private unsavedChangesConfirmation = inject(UnsavedChangesConfirmationService);
  private modalService = inject(ModalService);

  readonly logLevels = LOG_LEVELS;

  private fb = inject(NonNullableFormBuilder);

  nameForm = this.fb.group({
    name: ['', Validators.required]
  });

  webServerForm = this.fb.group({
    port: [null as number | null, Validators.required]
  });

  proxyForm = this.fb.group({
    proxyEnabled: [false as boolean, Validators.required],
    proxyPort: [null as number | null, Validators.required]
  });

  loggerForm = this.fb.group({
    logParameters: this.fb.group({
      console: this.fb.group({
        level: ['silent' as LogLevel, Validators.required]
      }),
      file: this.fb.group({
        level: ['info' as LogLevel, Validators.required],
        maxFileSize: [null as number | null, [Validators.required, Validators.min(1), Validators.max(50)]],
        numberOfFiles: [null as number | null, [Validators.required, Validators.min(1)]]
      }),
      database: this.fb.group({
        level: ['info' as LogLevel, Validators.required],
        maxNumberOfLogs: [null as number | null, [Validators.required, Validators.min(100_000)]]
      }),
      loki: this.fb.group({
        level: ['silent' as LogLevel, Validators.required],
        interval: [null as number | null, [Validators.required, Validators.min(10)]],
        address: ['', Validators.pattern(/http.*/)],
        username: null as string | null,
        password: null as string | null
      }),
      oia: this.fb.group({
        level: ['silent' as LogLevel, Validators.required],
        interval: [null as number | null, [Validators.required, Validators.min(10)]]
      })
    })
  });

  nameState = new ObservableState();
  webServerState = new ObservableState();
  proxyState = new ObservableState();
  loggerState = new ObservableState();

  constructor() {
    this.proxyForm.controls.proxyEnabled.valueChanges.subscribe(next => {
      if (next) {
        this.proxyForm.controls.proxyPort.enable();
      } else {
        this.proxyForm.controls.proxyPort.disable();
        this.proxyForm.controls.proxyPort.setValue(null);
      }
    });

    // Handle conditional validators based on log levels
    const logParams = this.loggerForm.controls.logParameters;

    // OIA level changes
    logParams.controls.oia.controls.level.valueChanges.subscribe(level => {
      const intervalControl = logParams.controls.oia.controls.interval;
      if (level === 'silent') {
        intervalControl.clearValidators();
        intervalControl.disable();
      } else {
        intervalControl.setValidators([Validators.required, Validators.min(10)]);
        intervalControl.enable();
      }
      intervalControl.updateValueAndValidity();
    });

    // Database level changes
    logParams.controls.database.controls.level.valueChanges.subscribe(level => {
      const maxLogsControl = logParams.controls.database.controls.maxNumberOfLogs;
      if (level === 'silent') {
        maxLogsControl.clearValidators();
        maxLogsControl.disable();
      } else {
        maxLogsControl.setValidators([Validators.required, Validators.min(100_000)]);
        maxLogsControl.enable();
      }
      maxLogsControl.updateValueAndValidity();
    });

    // File level changes
    logParams.controls.file.controls.level.valueChanges.subscribe(level => {
      const maxFileSizeControl = logParams.controls.file.controls.maxFileSize;
      const numberOfFilesControl = logParams.controls.file.controls.numberOfFiles;
      if (level === 'silent') {
        maxFileSizeControl.clearValidators();
        maxFileSizeControl.disable();
        numberOfFilesControl.clearValidators();
        numberOfFilesControl.disable();
      } else {
        maxFileSizeControl.setValidators([Validators.required, Validators.min(1), Validators.max(50)]);
        maxFileSizeControl.enable();
        numberOfFilesControl.setValidators([Validators.required, Validators.min(1)]);
        numberOfFilesControl.enable();
      }
      maxFileSizeControl.updateValueAndValidity();
      numberOfFilesControl.updateValueAndValidity();
    });

    // Loki level changes
    logParams.controls.loki.controls.level.valueChanges.subscribe(level => {
      const intervalControl = logParams.controls.loki.controls.interval;
      const addressControl = logParams.controls.loki.controls.address;
      if (level === 'silent') {
        intervalControl.clearValidators();
        intervalControl.disable();
        addressControl.clearValidators();
        addressControl.disable();
      } else {
        intervalControl.setValidators([Validators.required, Validators.min(10)]);
        intervalControl.enable();
        addressControl.setValidators([Validators.pattern(/http.*/)]);
        addressControl.enable();
      }
      intervalControl.updateValueAndValidity();
      addressControl.updateValueAndValidity();
    });
  }

  isLevelSilent(category: 'console' | 'file' | 'database' | 'loki' | 'oia'): boolean {
    const level = this.loggerForm.controls.logParameters.controls[category].controls.level.value;
    return level === 'silent';
  }

  ngOnInit(): void {
    this.engineService.getEngineSettings().subscribe(settings => {
      this.nameForm.patchValue({ name: settings.name });
      this.webServerForm.patchValue({ port: settings.port });
      this.proxyForm.patchValue({ proxyEnabled: settings.proxyEnabled, proxyPort: settings.proxyPort });
      this.loggerForm.patchValue({ logParameters: settings.logParameters });
      this.initializeLoggerValidators();
    });
  }

  private initializeLoggerValidators(): void {
    const logParams = this.loggerForm.controls.logParameters;

    const oiaLevel = logParams.controls.oia.controls.level.value;
    const oiaIntervalControl = logParams.controls.oia.controls.interval;
    if (oiaLevel === 'silent') {
      oiaIntervalControl.clearValidators();
      oiaIntervalControl.disable();
    } else {
      oiaIntervalControl.setValidators([Validators.required, Validators.min(10)]);
      oiaIntervalControl.enable();
    }

    const dbLevel = logParams.controls.database.controls.level.value;
    const maxLogsControl = logParams.controls.database.controls.maxNumberOfLogs;
    if (dbLevel === 'silent') {
      maxLogsControl.clearValidators();
      maxLogsControl.disable();
    } else {
      maxLogsControl.setValidators([Validators.required, Validators.min(100_000)]);
      maxLogsControl.enable();
    }

    const fileLevel = logParams.controls.file.controls.level.value;
    const maxFileSizeControl = logParams.controls.file.controls.maxFileSize;
    const numberOfFilesControl = logParams.controls.file.controls.numberOfFiles;
    if (fileLevel === 'silent') {
      maxFileSizeControl.clearValidators();
      maxFileSizeControl.disable();
      numberOfFilesControl.clearValidators();
      numberOfFilesControl.disable();
    } else {
      maxFileSizeControl.setValidators([Validators.required, Validators.min(1), Validators.max(50)]);
      maxFileSizeControl.enable();
      numberOfFilesControl.setValidators([Validators.required, Validators.min(1)]);
      numberOfFilesControl.enable();
    }

    const lokiLevel = logParams.controls.loki.controls.level.value;
    const lokiIntervalControl = logParams.controls.loki.controls.interval;
    const lokiAddressControl = logParams.controls.loki.controls.address;
    if (lokiLevel === 'silent') {
      lokiIntervalControl.clearValidators();
      lokiIntervalControl.disable();
      lokiAddressControl.clearValidators();
      lokiAddressControl.disable();
    } else {
      lokiIntervalControl.setValidators([Validators.required, Validators.min(10)]);
      lokiIntervalControl.enable();
      lokiAddressControl.setValidators([Validators.pattern(/http.*/)]);
      lokiAddressControl.enable();
    }
  }

  canDeactivate(): Observable<boolean> | boolean {
    const anyDirty = this.nameForm.dirty || this.webServerForm.dirty || this.proxyForm.dirty || this.loggerForm.dirty;
    if (anyDirty) {
      return this.unsavedChangesConfirmation.confirmUnsavedChanges();
    }
    return true;
  }

  saveName(): void {
    if (!this.nameForm.valid) {
      return;
    }
    const { name } = this.nameForm.getRawValue();
    this.engineService
      .updateEngineName({ name: name! })
      .pipe(this.nameState.pendingUntilFinalization())
      .subscribe(() => {
        this.nameForm.markAsPristine();
        this.notificationService.success('engine.updated');
      });
  }

  saveWebServer(): void {
    if (!this.webServerForm.valid) {
      return;
    }
    const { port } = this.webServerForm.getRawValue();
    this.engineService
      .updateEngineWebServer({ port: port! })
      .pipe(this.webServerState.pendingUntilFinalization())
      .subscribe(result => {
        this.webServerForm.markAsPristine();
        if (result.needsRedirect && result.newPort) {
          const modal = this.modalService.open(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
          modal.componentInstance.initialize(result.newPort);
        } else {
          this.notificationService.success('engine.updated');
        }
      });
  }

  saveProxy(): void {
    if (!this.proxyForm.valid) {
      return;
    }
    const formValue = this.proxyForm.getRawValue();
    this.engineService
      .updateEngineProxy({
        proxyEnabled: formValue.proxyEnabled!,
        proxyPort: formValue.proxyEnabled ? formValue.proxyPort || null : null
      })
      .pipe(this.proxyState.pendingUntilFinalization())
      .subscribe(() => {
        this.proxyForm.markAsPristine();
        this.notificationService.success('engine.updated');
      });
  }

  saveLogger(): void {
    if (!this.loggerForm.valid) {
      return;
    }
    const formValue = this.loggerForm.getRawValue();
    this.engineService
      .updateEngineLogger({
        logParameters: {
          console: { level: formValue.logParameters!.console!.level! },
          file: {
            level: formValue.logParameters!.file!.level!,
            maxFileSize: formValue.logParameters!.file!.maxFileSize!,
            numberOfFiles: formValue.logParameters!.file!.numberOfFiles!
          },
          database: {
            level: formValue.logParameters!.database!.level!,
            maxNumberOfLogs: formValue.logParameters!.database!.maxNumberOfLogs!
          },
          loki: {
            level: formValue.logParameters!.loki!.level!,
            interval: formValue.logParameters!.loki!.interval!,
            address: formValue.logParameters!.loki!.address!,
            username: formValue.logParameters!.loki!.username!,
            password: formValue.logParameters!.loki!.password!
          },
          oia: {
            level: formValue.logParameters!.oia!.level!,
            interval: formValue.logParameters!.oia!.interval!
          }
        }
      })
      .pipe(this.loggerState.pendingUntilFinalization())
      .subscribe(() => {
        this.loggerForm.markAsPristine();
        this.notificationService.success('engine.updated');
      });
  }
}
