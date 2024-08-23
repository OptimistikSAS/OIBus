import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleSelectComponent } from './single-select.component';

describe('SingleSelectComponent', () => {
  let component: SingleSelectComponent;
  let fixture: ComponentFixture<SingleSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SingleSelectComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(SingleSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
