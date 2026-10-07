import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Use as a route destination in tests when its rendered content is irrelevant. */
@Component({
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyRouteComponent {}
