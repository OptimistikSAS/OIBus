import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CurrentUserService } from '../shared/current-user.service';
import { User } from '../../../../shared/model/user.model';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { NgIf } from '@angular/common';
import { EngineService } from '../services/engine.service';
import { OIBusInfo } from '../../../../shared/model/engine.model';
import { of, switchMap } from 'rxjs';

@Component({
  selector: 'oib-navbar',
  standalone: true,
  imports: [RouterLink, TranslateModule, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgIf],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  user: User | null = null;
  info: OIBusInfo | null = null;

  constructor(private currentUserService: CurrentUserService, private engineService: EngineService) {}

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
