import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { NotificationComponent } from './shared/notification/notification.component';
import { DefaultValidationErrorsComponent } from './shared/default-validation-errors/default-validation-errors.component';
import { BreadcrumbComponent } from './shared/breadcrumb/breadcrumb.component';
import { WindowService } from './shared/window.service';
import { CurrentUserService } from './shared/current-user.service';
import { UserDTO } from '../../../backend/shared/model/user.model';
import { NavigationService } from './shared/navigation.service';
import { VersionCheckService } from './shared/version-check.service';
import { ModalService } from './shared/modal.service';
import { VersionUpdateModalComponent } from './shared/version-update-modal/version-update-modal.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'oib-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  imports: [RouterOutlet, NavbarComponent, NotificationComponent, DefaultValidationErrorsComponent, BreadcrumbComponent]
})
export class AppComponent implements OnInit, OnDestroy {
  private currentUserService = inject(CurrentUserService);
  private windowService = inject(WindowService);
  private navigationService = inject(NavigationService);
  private versionCheckService = inject(VersionCheckService);
  private modalService = inject(ModalService);

  private versionChangeSubscription: Subscription | null = null;

  title = 'OIBus';

  ngOnInit(): void {
    this.navigationService.init();
    this.currentUserService.get().subscribe(user => {
      this.reloadIfLanguageOrTimezoneNeedsChange(user);

      // Start version monitoring when user is authenticated
      if (user) {
        this.startVersionMonitoring();
      }
    });
  }

  ngOnDestroy(): void {
    this.versionCheckService.stopMonitoring();
    if (this.versionChangeSubscription) {
      this.versionChangeSubscription.unsubscribe();
    }
  }

  private startVersionMonitoring(): void {
    this.versionCheckService.startMonitoring();

    this.versionChangeSubscription = this.versionCheckService.versionChange$.subscribe(info => {
      // Open non-dismissible modal when version changes
      const modalRef = this.modalService.open(VersionUpdateModalComponent, {
        backdrop: 'static',
        keyboard: false
      });
      modalRef.componentInstance.oldVersion = info.oldVersion;
      modalRef.componentInstance.newVersion = info.newVersion;
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
