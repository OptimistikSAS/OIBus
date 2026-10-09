import { Directive, inject } from '@angular/core';

import { NavigationService } from './navigation.service';

@Directive({
  selector: '[oibBackButton]',
  host: {
    '(click)': 'onClick()'
  }
})
export class BackNavigationDirective {
  private readonly navigation = inject(NavigationService);

  onClick(): void {
    this.navigation.back();
  }
}
