import { Directive, HostListener } from '@angular/core';
import { NavigationService } from './navigation.service';

@Directive({
  selector: '[oibBackButton]',
  standalone: true
})
export class BackNavigationDirective {
  constructor(private navigation: NavigationService) {}

  @HostListener('click')
  onClick(): void {
    this.navigation.back();
  }
}
