import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormControl, NonNullableFormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgForOf, NgIf } from '@angular/common';
import { EngineService } from '../../services/engine.service';
import { ProxyService } from '../../services/proxy.service';
import { ProxyDTO } from '../../../../../shared/model/proxy.model';
import { EngineSettingsCommandDTO, LOG_LEVELS, LogLevel } from '../../../../../shared/model/engine.model';
import { NotificationService } from '../../shared/notification.service';
import { formDirectives } from '../../shared/form-directives';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';
import { createAuthenticationForm, getAuthenticationDTOFromForm } from '../../shared/utils';
import { OibAuthComponent } from '../../shared/form/oib-auth/oib-auth.component';
import { BoxComponent } from '../../shared/box/box.component';

@Component({
  selector: 'oib-edit-engine',
  standalone: true,
  imports: [TranslateModule, ...formDirectives, RouterLink, NgForOf, NgIf, SaveButtonComponent, OibAuthComponent, BoxComponent],
  templateUrl: './edit-engine.component.html',
  styleUrls: ['./edit-engine.component.scss']
})
export class EditEngineComponent implements OnInit {
  readonly logLevels = LOG_LEVELS;

  proxies: Array<ProxyDTO> = [];

  engineForm = this.fb.group({
    name: ['', Validators.required],
    port: [null as number | null, Validators.required],
    logParameters: this.fb.group({
      console: this.fb.group({
        level: ['silent' as LogLevel, Validators.required]
      }),
      file: this.fb.group({
        level: ['info' as LogLevel, Validators.required],
        maxFileSize: [null as number | null, Validators.min(1)],
        numberOfFiles: [null as number | null, Validators.min(1)]
      }),
      database: this.fb.group({
        level: ['info' as LogLevel, Validators.required],
        maxNumberOfLogs: [null as number | null, [Validators.min(100_000)]]
      }),
      loki: this.fb.group({
        level: ['silent' as LogLevel, Validators.required],
        interval: [null as number | null, Validators.min(10)],
        address: ['', Validators.pattern(/http.*/)],
        tokenAddress: ['', Validators.pattern(/http.*/)],
        proxyId: null as string | null,
        username: null as string | null,
        password: null as string | null
      })
    }),
    healthSignal: this.fb.group({
      logging: this.fb.group({
        enabled: false,
        interval: [null as number | null, Validators.min(10)]
      }),
      http: this.fb.group({
        enabled: false,
        interval: [null as number | null, Validators.min(10)],
        verbose: false,
        address: ['', Validators.pattern(/http.*/)],
        proxyId: null as string | null,
        authentication: new FormControl(createAuthenticationForm({ type: 'none' }))
      })
    })
  });

  state = new ObservableState();

  constructor(
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private engineService: EngineService,
    private proxyService: ProxyService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.proxyService.list().subscribe(proxyList => {
      this.proxies = proxyList;
    });
    this.engineService.getEngineSettings().subscribe(settings => {
      const formValue = {
        ...settings,
        healthSignal: {
          ...settings.healthSignal,
          http: {
            ...settings.healthSignal.http,
            authentication: createAuthenticationForm(settings.healthSignal.http.authentication)
          }
        }
      };
      this.engineForm.patchValue(formValue);
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
          tokenAddress: formValue.logParameters!.loki!.tokenAddress!,
          username: formValue.logParameters!.loki!.username!,
          password: formValue.logParameters!.loki!.password!,
          proxyId: formValue.logParameters!.loki!.proxyId!
        }
      },
      healthSignal: {
        logging: {
          enabled: formValue.healthSignal!.logging!.enabled!,
          interval: formValue.healthSignal!.logging!.interval!
        },
        http: {
          enabled: formValue.healthSignal!.http!.enabled!,
          interval: formValue.healthSignal!.http!.interval!,
          verbose: formValue.healthSignal!.http!.verbose!,
          address: formValue.healthSignal!.http!.address!,
          proxyId: formValue.healthSignal!.http!.proxyId!,
          authentication: getAuthenticationDTOFromForm(formValue.healthSignal!.http!.authentication!)
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
