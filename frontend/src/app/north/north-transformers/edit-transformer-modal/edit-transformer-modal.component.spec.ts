import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditTransformerModalComponent } from './edit-transformer-modal.component';

describe('EditTransformerModalComponent', () => {
  let component: EditTransformerModalComponent;
  let fixture: ComponentFixture<EditTransformerModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditTransformerModalComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(EditTransformerModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
