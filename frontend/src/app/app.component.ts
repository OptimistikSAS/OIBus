import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './navbar/navbar.component';
import { NotificationComponent } from './shared/notification/notification.component';
import { DefaultValidationErrorsComponent } from './shared/default-validation-errors/default-validation-errors.component';

@Component({
  selector: 'oib-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, NotificationComponent, DefaultValidationErrorsComponent]
})
export class AppComponent {
  title = 'OIBus';
}
