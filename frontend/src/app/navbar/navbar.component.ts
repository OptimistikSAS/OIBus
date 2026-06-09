import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateDirective, TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { CurrentUserService } from '../shared/current-user.service';
import { EngineService } from '../services/engine.service';
import { PageTitleDirective } from '../services/page-title.directive';

@Component({
  selector: 'oib-navbar',
  imports: [
    RouterLink,
    TranslateDirective,
    NgbDropdown,
    NgbDropdownToggle,
    NgbDropdownMenu,
    PageTitleDirective,
    NgbTooltip,
    TranslateModule
  ],
  templateUrl: './navbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly currentUserService = inject(CurrentUserService);
  private readonly engineService = inject(EngineService);

  private readonly user$ = this.currentUserService.get();
  readonly user = toSignal(this.user$, { initialValue: null });
  readonly info = toSignal(this.user$.pipe(switchMap(user => (user ? this.engineService.info$ : of(null)))), { initialValue: null });

  logout() {
    this.currentUserService.logout();
  }
}
