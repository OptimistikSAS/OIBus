import { Component, inject } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateDirective } from '@ngx-translate/core';
import { EngineService } from '../../services/engine.service';
import { NotificationService } from '../../shared/notification.service';
import { AuthTokenDuration, EngineSettingsDTO } from '../../../../../backend/shared/model/engine.model';
import { OI_FORM_VALIDATION_DIRECTIVES } from '../../shared/form/form-validation-directives';
import { ModalService } from '../../shared/modal.service';
import { PortRedirectModalComponent } from '../../shared/port-redirect-modal/port-redirect-modal.component';

@Component({
  selector: 'oib-edit-engine-web-server-modal',
  templateUrl: './edit-engine-web-server-modal.component.html',
  styleUrl: './edit-engine-web-server-modal.component.scss',
  imports: [TranslateDirective, ReactiveFormsModule, OI_FORM_VALIDATION_DIRECTIVES]
})
export class EditEngineWebServerModalComponent {
  private modal = inject(NgbActiveModal);
  private engineService = inject(EngineService);
  private notificationService = inject(NotificationService);
  private modalService = inject(ModalService);

  readonly authTokenDurationOptions: Array<{ value: AuthTokenDuration; labelKey: string }> = [
    { value: '1h', labelKey: 'engine.web-server-settings.auth-token-duration-options.1h' },
    { value: '6h', labelKey: 'engine.web-server-settings.auth-token-duration-options.6h' },
    { value: '1d', labelKey: 'engine.web-server-settings.auth-token-duration-options.1d' },
    { value: '3d', labelKey: 'engine.web-server-settings.auth-token-duration-options.3d' },
    { value: '7d', labelKey: 'engine.web-server-settings.auth-token-duration-options.7d' },
    { value: '14d', labelKey: 'engine.web-server-settings.auth-token-duration-options.14d' },
    { value: '30d', labelKey: 'engine.web-server-settings.auth-token-duration-options.30d' }
  ];

  form = inject(NonNullableFormBuilder).group({
    port: [null as number | null, Validators.required],
    authTokenDuration: ['7d' as AuthTokenDuration, Validators.required]
  });

  initialize(settings: EngineSettingsDTO) {
    this.form.patchValue({ port: settings.webServer.port, authTokenDuration: settings.webServer.authTokenDuration });
  }

  save() {
    if (!this.form.valid) {
      return;
    }
    const { port, authTokenDuration } = this.form.getRawValue();
    this.engineService.updateEngineWebServer({ port: port!, authTokenDuration }).subscribe(result => {
      if (result.needsRedirect && result.newPort) {
        this.modal.close();
        const redirectModal = this.modalService.open(PortRedirectModalComponent, { backdrop: 'static', keyboard: false });
        redirectModal.componentInstance.initialize(result.newPort);
      } else {
        this.notificationService.success('engine.updated');
        this.modal.close();
      }
    });
  }

  cancel() {
    this.modal.dismiss();
  }
}
