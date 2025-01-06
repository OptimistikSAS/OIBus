import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateDirective } from '@ngx-translate/core';
import { CurrentUserService } from '../shared/current-user.service';
import { UserDTO } from '../../../../backend/shared/model/user.model';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';

import { EngineService } from '../services/engine.service';
import { OIBusInfo } from '../../../../backend/shared/model/engine.model';
import { of, switchMap } from 'rxjs';
import { PageTitleDirective } from '../services/page-title.directive';

@Component({
  selector: 'oib-navbar',
  imports: [RouterLink, TranslateDirective, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, PageTitleDirective],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent implements OnInit {
  private currentUserService = inject(CurrentUserService);
  private engineService = inject(EngineService);

  user: UserDTO | null = null;
  info: OIBusInfo | null = null;

  ngOnInit() {
    this.currentUserService.get().subscribe(u => (this.user = u));
    this.engineService.getInfo().subscribe(u => (this.info = u));

    this.currentUserService
      .get()
      .pipe(
        switchMap(user => {
          this.user = user;
          if (this.user) {
            return this.engineService.getInfo();
          }
          return of(null);
        })
      )
      .subscribe(info => (this.info = info));
  }

  logout() {
    this.currentUserService.logout();
  }
}
