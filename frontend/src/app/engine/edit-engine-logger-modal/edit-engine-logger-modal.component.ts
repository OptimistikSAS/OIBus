import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { LOG_LEVELS, LogLevel } from '../../../../../backend/shared/model/logs.model';

@Component({
  selector: 'oib-edit-engine-logger-modal',
  templateUrl: './edit-engine-logger-modal.component.html',
  styleUrl: './edit-engine-logger-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineLoggerModalComponent {
  private modal = inject(NgbActiveModal);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);

  readonly logLevels = LOG_LEVELS;

  private fb = inject(NonNullableFormBuilder);

  form = this.fb.group({
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

  constructor() {
    const logParams = this.form.controls.logParameters;

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
    return this.form.controls.logParameters.controls[category].controls.level.value === 'silent';
  }

  initialize(settings: EngineSettingsDTO) {
    this.form.patchValue({ logParameters: settings.logParameters });
    this.initializeValidators();
  }

  private initializeValidators(): void {
    const logParams = this.form.controls.logParameters;

    const oiaLevel = logParams.controls.oia.controls.level.value;
    const oiaInterval = logParams.controls.oia.controls.interval;
    if (oiaLevel === 'silent') {
      oiaInterval.clearValidators();
      oiaInterval.disable();
    } else {
      oiaInterval.setValidators([Validators.required, Validators.min(10)]);
      oiaInterval.enable();
    }

    const dbLevel = logParams.controls.database.controls.level.value;
    const maxLogs = logParams.controls.database.controls.maxNumberOfLogs;
    if (dbLevel === 'silent') {
      maxLogs.clearValidators();
      maxLogs.disable();
    } else {
      maxLogs.setValidators([Validators.required, Validators.min(100_000)]);
      maxLogs.enable();
    }

    const fileLevel = logParams.controls.file.controls.level.value;
    const maxFileSize = logParams.controls.file.controls.maxFileSize;
    const numberOfFiles = logParams.controls.file.controls.numberOfFiles;
    if (fileLevel === 'silent') {
      maxFileSize.clearValidators();
      maxFileSize.disable();
      numberOfFiles.clearValidators();
      numberOfFiles.disable();
    } else {
      maxFileSize.setValidators([Validators.required, Validators.min(1), Validators.max(50)]);
      maxFileSize.enable();
      numberOfFiles.setValidators([Validators.required, Validators.min(1)]);
      numberOfFiles.enable();
    }

    const lokiLevel = logParams.controls.loki.controls.level.value;
    const lokiInterval = logParams.controls.loki.controls.interval;
    const lokiAddress = logParams.controls.loki.controls.address;
    if (lokiLevel === 'silent') {
      lokiInterval.clearValidators();
      lokiInterval.disable();
      lokiAddress.clearValidators();
      lokiAddress.disable();
    } else {
      lokiInterval.setValidators([Validators.required, Validators.min(10)]);
      lokiInterval.enable();
      lokiAddress.setValidators([Validators.pattern(/http.*/)]);
      lokiAddress.enable();
    }
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const formValue = this.form.getRawValue();
    this.engineService
      .updateEngineLogger({
        console: { level: formValue.logParameters.console.level },
        file: {
          level: formValue.logParameters.file.level,
          maxFileSize: formValue.logParameters.file.maxFileSize!,
          numberOfFiles: formValue.logParameters.file.numberOfFiles!
        },
        database: {
          level: formValue.logParameters.database.level,
          maxNumberOfLogs: formValue.logParameters.database.maxNumberOfLogs!
        },
        loki: {
          level: formValue.logParameters.loki.level,
          interval: formValue.logParameters.loki.interval!,
          address: formValue.logParameters.loki.address,
          username: formValue.logParameters.loki.username ?? '',
          password: formValue.logParameters.loki.password ?? ''
        },
        oia: {
          level: formValue.logParameters.oia.level,
          interval: formValue.logParameters.oia.interval!
        }
      })
      .subscribe(() => {
        this.notificationService.success('engine.updated');
        this.modal.close();
      });
  }

  cancel() {
    this.modal.dismiss();
  }
}
