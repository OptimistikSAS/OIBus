import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NorthTransformersComponent } from './north-transformers.component';

describe('NorthTransformersComponent', () => {
  let component: NorthTransformersComponent;
  let fixture: ComponentFixture<NorthTransformersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NorthTransformersComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(NorthTransformersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
