import { TestBed } from '@angular/core/testing';

import { EngineComponent } from './engine.component';
import { ComponentTester } from 'ngx-speculoos';
import { provideTestingI18n } from '../../i18n/mock-i18n';

class EngineComponentTester extends ComponentTester<EngineComponent> {
  constructor() {
    super(EngineComponent);
  }

  get title() {
    return this.element('h1');
  }
}

describe('EngineComponent', () => {
  let tester: EngineComponentTester;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EngineComponent],
      providers: [provideTestingI18n()]
    }).compileComponents();

    tester = new EngineComponentTester();
    tester.detectChanges();
  });

  it('should display title', () => {
    expect(tester.title).toContainText('Engine settings');
  });
});
