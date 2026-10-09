import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';

import { UserDTO } from '@oibus/shared/api/user.model';

import { NavbarComponent } from './navbar/navbar.component';
import { BreadcrumbComponent } from './shared/breadcrumb/breadcrumb.component';
import { CurrentUserService } from './shared/current-user.service';
import { DefaultValidationErrorsComponent } from './shared/default-validation-errors/default-validation-errors.component';
import { ModalService } from './shared/modal.service';
import { NavigationService } from './shared/navigation.service';
import { NotificationComponent } from './shared/notification/notification.component';
import { VersionCheckService } from './shared/version-check.service';
import { VersionUpdateModalComponent } from './shared/version-update-modal/version-update-modal.component';
import { WindowService } from './shared/window.service';

@Component({
  selector: 'oib-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, NotificationComponent, DefaultValidationErrorsComponent, BreadcrumbComponent]
})
export class AppComponent implements OnInit, OnDestroy {
  private currentUserService = inject(CurrentUserService);
  private windowService = inject(WindowService);
  private navigationService = inject(NavigationService);
  private versionCheckService = inject(VersionCheckService);
  private modalService = inject(ModalService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.navigationService.init();
    this.currentUserService
      .get()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(user => {
        this.reloadIfLanguageOrTimezoneNeedsChange(user);

        // Start version monitoring when user is authenticated
        if (user) {
          this.startVersionMonitoring();
        }
      });
  }

  ngOnDestroy(): void {
    this.versionCheckService.stopMonitoring();
  }

  private startVersionMonitoring(): void {
    this.versionCheckService.startMonitoring();

    this.versionCheckService.versionChange$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(info => {
      // Open non-dismissible modal when version changes
      const modalRef = this.modalService.open(VersionUpdateModalComponent, {
        backdrop: 'static',
        keyboard: false
      });
      modalRef.componentInstance.initialize(info.oldVersion, info.newVersion);
    });
  }

  private reloadIfLanguageOrTimezoneNeedsChange(user: UserDTO | null) {
    // if the user language is not the used one
    if (user && (user.language !== this.windowService.languageToUse() || user.timezone !== this.windowService.timezoneToUse())) {
      // then first store the new ones
      this.windowService.storeLanguage(user.language);
      this.windowService.storeTimezone(user.timezone);
      // then reload
      this.windowService.reload();
    }
  }
}
