import { ChangeDetectionStrategy, Component, inject, Signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateDirective } from '@ngx-translate/core';

import { EngineSettingsDTO } from '@oibus/shared/api/engine.model';
import { LOG_LEVELS, LogLevel } from '@oibus/shared/domain/logs.model';

import { EngineService } from '../../services/engine.service';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { NotificationService } from '../../shared/notification.service';

type LoggerOutput = 'console' | 'file' | 'database' | 'loki' | 'oia' | 'syslog';
/** The outputs that have settings besides their level */
const LEVEL_DEPENDENT_OUTPUTS = ['oia', 'database', 'file', 'loki'] as const;
type LevelDependentOutput = (typeof LEVEL_DEPENDENT_OUTPUTS)[number];

@Component({
  selector: 'oib-edit-engine-logger-modal',
  templateUrl: './edit-engine-logger-modal.component.html',
  styleUrl: './edit-engine-logger-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineLoggerModalComponent {
  private readonly modal = inject(NgbActiveModal);
  private readonly engineService = inject(EngineService);
  private readonly notificationService = inject(NotificationService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly logLevels = LOG_LEVELS;

  readonly form = this.fb.group({
    auditRetentionDuration: [0 as number | null, [Validators.required, Validators.min(0)]],
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
      }),
      syslog: this.fb.group({
        level: ['silent' as LogLevel, Validators.required],
        host: ['' as string],
        port: [514 as number | null, [Validators.required, Validators.min(1), Validators.max(65535)]],
        protocol: ['udp4' as 'udp4' | 'tcp', Validators.required]
      })
    })
  });

  /** Level of each logging output, as signals for the template (the form is also patched by `initialize()`) */
  private readonly levels: Record<LoggerOutput, Signal<LogLevel>> = {
    console: this.levelSignal('console'),
    file: this.levelSignal('file'),
    database: this.levelSignal('database'),
    loki: this.levelSignal('loki'),
    oia: this.levelSignal('oia'),
    syslog: this.levelSignal('syslog')
  };

  /** Settings only used (and validated) when the level of their output is not silent */
  private readonly levelDependentControls: Record<
    LevelDependentOutput,
    Array<{ control: AbstractControl; validators: Array<ValidatorFn> }>
  > = {
    oia: [
      { control: this.form.controls.logParameters.controls.oia.controls.interval, validators: [Validators.required, Validators.min(10)] }
    ],
    database: [
      {
        control: this.form.controls.logParameters.controls.database.controls.maxNumberOfLogs,
        validators: [Validators.required, Validators.min(100_000)]
      }
    ],
    file: [
      {
        control: this.form.controls.logParameters.controls.file.controls.maxFileSize,
        validators: [Validators.required, Validators.min(1), Validators.max(50)]
      },
      {
        control: this.form.controls.logParameters.controls.file.controls.numberOfFiles,
        validators: [Validators.required, Validators.min(1)]
      }
    ],
    loki: [
      { control: this.form.controls.logParameters.controls.loki.controls.interval, validators: [Validators.required, Validators.min(10)] },
      { control: this.form.controls.logParameters.controls.loki.controls.address, validators: [Validators.pattern(/http.*/)] }
    ]
  };

  constructor() {
    for (const output of LEVEL_DEPENDENT_OUTPUTS) {
      this.form.controls.logParameters.controls[output].controls.level.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(level => this.applyLevel(output, level));
    }
  }

  private levelSignal(output: LoggerOutput): Signal<LogLevel> {
    const levelControl = this.form.controls.logParameters.controls[output].controls.level;
    return toSignal(levelControl.valueChanges, { initialValue: levelControl.value });
  }

  isLevelSilent(output: LoggerOutput): boolean {
    return this.levels[output]() === 'silent';
  }

  initialize(settings: EngineSettingsDTO) {
    this.form.patchValue({ auditRetentionDuration: settings.auditRetentionDuration ?? 0, logParameters: settings.logger });
    for (const output of LEVEL_DEPENDENT_OUTPUTS) {
      this.applyLevel(output, this.form.controls.logParameters.controls[output].controls.level.value);
    }
  }

  /**
   * Disables (and stops validating) the settings of an output when its level is silent, enables them otherwise.
   */
  private applyLevel(output: LevelDependentOutput, level: LogLevel) {
    for (const { control, validators } of this.levelDependentControls[output]) {
      if (level === 'silent') {
        control.clearValidators();
        control.disable();
      } else {
        control.setValidators(validators);
        control.enable();
      }
      control.updateValueAndValidity();
    }
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const formValue = this.form.getRawValue();
    this.engineService
      .updateEngineLogger({
        auditRetentionDuration: formValue.auditRetentionDuration,
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
        },
        syslog: {
          level: formValue.logParameters.syslog.level,
          host: formValue.logParameters.syslog.host,
          port: formValue.logParameters.syslog.port!,
          protocol: formValue.logParameters.syslog.protocol
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
