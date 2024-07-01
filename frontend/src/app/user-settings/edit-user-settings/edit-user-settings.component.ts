import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { Language, LANGUAGES, Timezone } from '../../../../../shared/model/types';
import { Observable, of, switchMap, tap, timer } from 'rxjs';
import { inMemoryTypeahead } from '../../shared/typeahead';
import { CurrentUserService } from '../../shared/current-user.service';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { User, UserCommandDTO } from '../../../../../shared/model/user.model';
import { ModalService } from '../../shared/modal.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { NotificationService } from '../../shared/notification.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { WindowService } from '../../shared/window.service';
import { formDirectives } from '../../shared/form-directives';

import { NgbTypeahead } from '@ng-bootstrap/ng-bootstrap';
import { ObservableState, SaveButtonComponent } from '../../shared/save-button/save-button.component';

// TypeScript issue with Intl: https://github.com/microsoft/TypeScript/issues/49231
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Intl {
  type Key = 'calendar' | 'collation' | 'currency' | 'numberingSystem' | 'timeZone' | 'unit';

  function supportedValuesOf(input: Key): string[];
}

@Component({
  selector: 'oib-edit-user-settings',
  templateUrl: './edit-user-settings.component.html',
  styleUrl: './edit-user-settings.component.scss',
  imports: [...formDirectives, TranslateModule, NgbTypeahead, SaveButtonComponent],
  standalone: true
})
export class EditUserSettingsComponent {
  form = inject(NonNullableFormBuilder).group({
    firstName: ['', [Validators.maxLength(50)]],
    lastName: ['', [Validators.maxLength(50)]],
    timezone: ['' as Timezone, Validators.required]
  });
  editedUserSettings: User | null = null;
  languages: Array<Language> = LANGUAGES;

  state = new ObservableState();

  private timezones: ReadonlyArray<Timezone> = Intl.supportedValuesOf('timeZone');
  timezoneTypeahead: (text$: Observable<string>) => Observable<Array<Timezone>> = inMemoryTypeahead(
    () => ['UTC', ...this.timezones],
    timezone => timezone
  );

  constructor(
    private modalService: ModalService,
    private userSettingsService: UserSettingsService,
    private notificationService: NotificationService,
    private translateService: TranslateService,
    private windowService: WindowService,
    private currentUserService: CurrentUserService
  ) {
    this.loadSettingsAndPopulate().subscribe();
  }

  save() {
    if (!this.form.valid) {
      return;
    }

    const formValue = this.form.value;
    const command: UserCommandDTO = {
      email: this.editedUserSettings!.email,
      login: this.editedUserSettings!.login,
      firstName: formValue.firstName!,
      lastName: formValue.lastName!,
      language: this.editedUserSettings!.language!,
      timezone: formValue.timezone!
    };

    this.userSettingsService
      .update(this.editedUserSettings!.id, command)
      .pipe(
        this.state.pendingUntilFinalization(),
        tap(() => {
          this.notificationService.success('user-settings.edit-user-settings.saved');
        }),
        switchMap(() => this.loadSettingsAndPopulate()),
        switchMap(settings => {
          if (settings.language === this.translateService.currentLang && settings.timezone === this.currentUserService.getTimezone()) {
            return of(settings);
          } else {
            return timer(500).pipe(
              tap(() => {
                this.windowService.storeLanguage(settings.language);
                this.windowService.storeTimezone(settings.timezone);
                this.windowService.reload();
              })
            );
          }
        })
      )
      .subscribe();
  }

  private loadSettingsAndPopulate(): Observable<User> {
    return this.userSettingsService.get().pipe(
      tap(settings => {
        this.editedUserSettings = settings;
        const formValue = {
          firstName: settings.firstName,
          lastName: settings.lastName,
          timezone: settings.timezone
        };
        this.form.setValue(formValue);
      })
    );
  }

  openChangePasswordModal() {
    this.modalService.open(ChangePasswordModalComponent, { size: 'sm' });
  }
}
