import { fakeAsync, TestBed } from '@angular/core/testing';

import { ComponentTester } from 'ngx-speculoos';
import { SearchItemComponent } from './search-item.component';
import { MockI18nModule } from '../../../i18n/mock-i18n.spec';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

class SearchItemComponentTester extends ComponentTester<SearchItemComponent> {
  constructor() {
    super(SearchItemComponent);
  }

  get name() {
    return this.input('#name')!;
  }

  get searchButton() {
    return this.button('#search-button')!;
  }
}

describe('SearchItemComponent', () => {
  let tester: SearchItemComponentTester;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MockI18nModule, ReactiveFormsModule, NoopAnimationsModule, SearchItemComponent],
      providers: []
    });

    tester = new SearchItemComponentTester();
  });

  it('should set the search form based on the inputs', () => {
    spyOn(tester.componentInstance.search, 'emit');
    tester.componentInstance.searchParams = {
      name: 'item name',
      page: 0
    };

    tester.detectChanges();

    expect(tester.name).toHaveValue('item name');
  });

  it('should filter the south items by search criteria', fakeAsync(() => {
    spyOn(tester.componentInstance.search, 'emit');
    tester.detectChanges();

    tester.name.fillWith('hello');

    tester.searchButton.click();

    expect(tester.componentInstance.search.emit).toHaveBeenCalledWith({
      name: 'hello',
      page: 0
    });
  }));
});
