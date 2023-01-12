import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { formDirectives } from '../../shared/form-directives';
import { SouthItemSearchParam } from '../../model/south-connector.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-search-item',
  templateUrl: './search-item.component.html',
  styleUrls: ['./search-item.component.scss'],
  imports: [...formDirectives, TranslateModule],
  standalone: true
})
export class SearchItemComponent {
  @Output() readonly search = new EventEmitter<SouthItemSearchParam>();

  readonly searchForm = this.fb.group({ name: '' });

  constructor(private fb: NonNullableFormBuilder) {}

  @Input()
  set searchParams(newSearchParams: SouthItemSearchParam) {
    this.searchForm.get('name')!.setValue(newSearchParams.name || '');
  }

  triggerSearch() {
    const formValue = this.searchForm.value;

    this.search.emit({ name: formValue.name!, page: 0 });
  }
}
