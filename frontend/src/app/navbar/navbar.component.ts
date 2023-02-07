import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CurrentUserService } from '../shared/current-user.service';
import { User } from '../../../../shared/model/user.model';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { NgIf } from '@angular/common';

@Component({
  selector: 'oib-navbar',
  standalone: true,
  imports: [RouterLink, TranslateModule, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgIf],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {
  user: User | null = null;

  constructor(private currentUserService: CurrentUserService) {}

  ngOnInit() {
    this.currentUserService.get().subscribe(u => (this.user = u));
  }

  logout() {
    this.currentUserService.logout();
  }
}
