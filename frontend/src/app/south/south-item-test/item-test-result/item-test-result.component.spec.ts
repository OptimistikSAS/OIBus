import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemTestResultComponent } from './item-test-result.component';

describe('ItemTestResultComponent', () => {
  let component: ItemTestResultComponent;
  let fixture: ComponentFixture<ItemTestResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ItemTestResultComponent] }).compileComponents();
    fixture = TestBed.createComponent(ItemTestResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
