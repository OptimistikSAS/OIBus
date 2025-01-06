import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { EngineService } from '../../services/engine.service';
import { EngineSettingsCommandDTO, LOG_LEVELS, LogLevel } from '../../../../../backend/shared/model/engine.model';
import { NotificationService } from '../../shared/notification.service';
import { formDirectives } from '../../shared/form-directives';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { BoxComponent } from '../../shared/box/box.component';
import { BackNavigationDirective } from '../../shared/back-navigation.directives';

@Component({
  selector: 'oib-edit-engine',
  imports: [TranslateModule, ...formDirectives, RouterLink, SaveButtonComponent, BoxComponent, BackNavigationDirective],
  templateUrl: './edit-engine.component.html',
  styleUrl: './edit-engine.component.scss'
})
export class EditEngineComponent implements OnInit {
  private notificationService = inject(NotificationService);
  private engineService = inject(EngineService);
  private router = inject(Router);

  readonly logLevels = LOG_LEVELS;

  private fb = inject(NonNullableFormBuilder);
  engineForm = this.fb.group({
    name: ['', Validators.required],
    port: [null as number | null, Validators.required],
    proxyEnabled: [false as boolean, Validators.required],
    proxyPort: [null as number | null, Validators.required],
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

  state = new ObservableState();

  constructor() {
    this.engineForm.controls.proxyEnabled.valueChanges.subscribe(next => {
      if (next) {
        this.engineForm.controls.proxyPort.enable();
      } else {
        this.engineForm.controls.proxyPort.disable();
      }
    });
  }

  ngOnInit(): void {
    this.engineService.getEngineSettings().subscribe(settings => {
      this.engineForm.patchValue(settings);
    });
  }

  save() {
    if (!this.engineForm.valid) {
      return;
    }

    const formValue = this.engineForm.value;
    const updatedSettings: EngineSettingsCommandDTO = {
      name: formValue.name!,
      port: formValue.port!,
      proxyEnabled: formValue.proxyEnabled!,
      proxyPort: formValue.proxyPort! || null,
      logParameters: {
        console: {
          level: formValue.logParameters!.console!.level!
        },
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
    };

    this.engineService
      .updateEngineSettings(updatedSettings)
      .pipe(this.state.pendingUntilFinalization())
      .subscribe(() => {
        this.notificationService.success('engine.updated');
        this.router.navigate(['/engine']);
      });
  }
}
