import { Component } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { NgbDropdown, NgbDropdownMenu, NgbDropdownToggle } from '@ng-bootstrap/ng-bootstrap';
import { NgIf } from '@angular/common';

@Component({
  selector: 'oib-sub-navbar',
  standalone: true,
  imports: [RouterLink, TranslateModule, NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgIf],
  templateUrl: './sub-navbar.component.html',
  styleUrls: ['./sub-navbar.component.scss']
})
export class SubNavbarComponent {
  northId = '';
  constructor(private route: ActivatedRoute) {
    this.route.paramMap.subscribe(params => {
      const paramNorthId = params.get('northId');
      if (paramNorthId) {
        this.northId = paramNorthId;
      }
    });
  }
}
