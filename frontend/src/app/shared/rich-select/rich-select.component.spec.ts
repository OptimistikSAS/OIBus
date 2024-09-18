import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RichSelectComponent } from './rich-select.component';

describe('RichSelectComponent', () => {
  let component: RichSelectComponent;
  let fixture: ComponentFixture<RichSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RichSelectComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(RichSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
