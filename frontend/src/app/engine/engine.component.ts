import { Component, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgForOf, NgIf } from '@angular/common';
import { EngineService } from '../services/engine.service';
import { ProxyService } from '../services/proxy.service';
import { ProxyDTO } from '../model/proxy.model';
import { AuthenticationType, EngineSettingsCommandDTO, LOG_LEVELS, LogLevel } from '../model/engine.model';
import { NotificationService } from '../components/shared/notification.service';
import { formDirectives } from '../components/shared/form-directives';

@Component({
  selector: 'oib-engine',
  standalone: true,
  imports: [TranslateModule, ...formDirectives, RouterLink, NgForOf, NgIf],
  templateUrl: './engine.component.html',
  styleUrls: ['./engine.component.scss']
})
export class EngineComponent implements OnInit {
  readonly logLevels = LOG_LEVELS;

  proxies: Array<ProxyDTO> = [];

  engineForm = this.fb.group({
    name: ['', Validators.required],
    port: [null as number | null, Validators.required],
    logParameters: this.fb.group({
      console: this.fb.group({
        level: [null as LogLevel | null, Validators.required]
      }),
      file: this.fb.group({
        level: [null as LogLevel | null, Validators.required],
        maxFileSize: [null as number | null, Validators.min(1)],
        numberOfFiles: [null as number | null, Validators.min(1)]
      }),
      database: this.fb.group({
        level: [null as LogLevel | null, Validators.required],
        maxNumberOfLogs: [null as number | null, [Validators.min(100_000)]]
      }),
      loki: this.fb.group({
        level: [null as LogLevel | null, Validators.required],
        interval: [null as number | null, Validators.min(10)],
        address: ['', Validators.pattern(/http.*/)],
        tokenAddress: ['', Validators.pattern(/http.*/)],
        proxy: null as ProxyDTO | null,
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
        proxy: null as ProxyDTO | null,
        authentication: this.fb.group({
          type: null as AuthenticationType | null,
          key: '',
          secret: ''
        })
      })
    })
  });

  constructor(
    private fb: NonNullableFormBuilder,
    private notificationService: NotificationService,
    private engineService: EngineService,
    private proxyService: ProxyService
  ) {}

  ngOnInit(): void {
    this.proxyService.getProxies().subscribe(proxies => {
      this.proxies = proxies;
    });
    this.engineService.getEngineSettings().subscribe(settings => {
      this.engineForm.patchValue({
        name: settings.name,
        port: settings.port,
        logParameters: {
          console: {
            level: settings.logParameters.console.level
          },
          file: {
            level: settings.logParameters.file.level,
            maxFileSize: settings.logParameters.file.maxFileSize,
            numberOfFiles: settings.logParameters.file.numberOfFiles
          },
          database: {
            level: settings.logParameters.database.level,
            maxNumberOfLogs: settings.logParameters.database.maxNumberOfLogs
          },
          loki: {
            level: settings.logParameters.loki.level,
            interval: settings.logParameters.loki.interval,
            address: settings.logParameters.loki.address,
            tokenAddress: settings.logParameters.loki.tokenAddress,
            username: settings.logParameters.loki.username,
            password: settings.logParameters.loki.password
          }
        },
        healthSignal: {
          logging: {
            enabled: settings.healthSignal.logging.enabled,
            interval: settings.healthSignal.logging.interval
          },
          http: {
            enabled: settings.healthSignal.http.enabled,
            verbose: settings.healthSignal.http.verbose,
            interval: settings.healthSignal.http.interval,
            address: settings.healthSignal.http.address,
            authentication: {
              type: settings.healthSignal.http.authentication.type,
              key: settings.healthSignal.http.authentication.key,
              secret: settings.healthSignal.http.authentication.secret
            }
          }
        }
      });
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
          proxyId: formValue.logParameters!.loki!.proxy ? formValue.logParameters!.loki!.proxy.id : null
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
          proxyId: formValue.healthSignal!.http!.proxy ? formValue.healthSignal!.http!.proxy.id : null,
          authentication: {
            type: formValue.healthSignal!.http!.authentication!.type!,
            key: formValue.healthSignal!.http!.authentication!.key!,
            secret: formValue.healthSignal!.http!.authentication!.secret!
          }
        }
      }
    };

    this.engineService.updateEngineSettings(updatedSettings).subscribe(() => {
      this.notificationService.success('engine.updated');
    });
  }
}
