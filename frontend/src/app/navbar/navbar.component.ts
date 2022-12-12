import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'oib-navbar',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent {}
