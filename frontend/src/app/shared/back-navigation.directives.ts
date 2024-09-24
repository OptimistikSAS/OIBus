import { Directive, HostListener, inject } from '@angular/core';
import { NavigationService } from './navigation.service';

@Directive({
  selector: '[oibBackButton]',
  standalone: true
})
export class BackNavigationDirective {
  private navigation = inject(NavigationService);

  @HostListener('click')
  onClick(): void {
    this.navigation.back();
  }
}
