import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NonNullableFormBuilder } from '@angular/forms';
import { formDirectives } from '../../shared/form-directives';
import { OibusItemSearchParam } from '../../../../../shared/model/south-connector.model';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'oib-search-item',
  templateUrl: './search-item.component.html',
  styleUrls: ['./search-item.component.scss'],
  imports: [...formDirectives, TranslateModule],
  standalone: true
})
export class SearchItemComponent {
  @Output() readonly search = new EventEmitter<OibusItemSearchParam>();

  readonly searchForm = this.fb.group({ name: '' });

  constructor(private fb: NonNullableFormBuilder) {}

  @Input()
  set searchParams(newSearchParams: OibusItemSearchParam) {
    this.searchForm.get('name')!.setValue(newSearchParams.name || '');
  }

  triggerSearch() {
    const formValue = this.searchForm.value;

    this.search.emit({ name: formValue.name!, page: 0 });
  }
}
