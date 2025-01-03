import { Directive, HostListener, inject } from '@angular/core';
import { NavigationService } from './navigation.service';

@Directive({
  selector: '[oibBackButton]'
})
export class BackNavigationDirective {
  private navigation = inject(NavigationService);

  @HostListener('click')
  onClick(): void {
    this.navigation.back();
  }
}
