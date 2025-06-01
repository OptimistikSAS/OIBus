import { inMemoryTypeahead } from './typeahead';
import { Subject } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';

describe('typeahead', () => {
  interface Item {
    label: string;
  }

  it('should filter shorter first, and sort by label', fakeAsync(() => {
    const items: Array<Item> = [
      'A',
      'A1',
      'A1000',
      'B',
      'B1',
      'B100',
      'C',
      'C1',
      'C10',
      'D',
      'D1',
      'D10',
      'E',
      'E1',
      'E10',
      'F',
      'F1',
      'F10'
    ].map(s => ({
      label: s
    }));

    const typeahead = inMemoryTypeahead<Item>(
      () => items,
      item => item.label
    );

    const source = new Subject<string>();
    const results: Array<Array<Item>> = [];
    typeahead(source).subscribe(array => results.push(array));

    source.next('a');
    tick(20);
    source.next('a1');
    tick(20);
    source.next('a');
    tick(300);

    source.next('');
    tick(20);
    source.next('1');
    tick(300);

    expect(results.length).toBe(2);
    expect(results[0].map(i => i.label)).toEqual(['A', 'A1', 'A1000']);
    expect(results[1].map(i => i.label)).toEqual(['A1', 'B1', 'C1', 'C10', 'D1', 'D10', 'E1', 'E10', 'F1', 'F10']);
  }));
});
