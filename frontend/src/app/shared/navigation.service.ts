import { Location } from '@angular/common';
import { inject, Service } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

@Service()
export class NavigationService {
  private router = inject(Router);
  private location = inject(Location);

  private history: Array<string> = [];

  init() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.history.push(event.urlAfterRedirects);
      }
    });
  }

  back(): void {
    this.history.pop();
    if (this.history.length > 0) {
      this.location.back();
    } else {
      this.router.navigateByUrl('/');
    }
  }
}
