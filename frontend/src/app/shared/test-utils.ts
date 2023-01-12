import { Provider } from '@angular/core';
import { NgbConfig } from '@ng-bootstrap/ng-bootstrap';
import { Page } from './types';

const NO_ANIMATION_NGB_CONFIG: NgbConfig = { animation: false };

export const noAnimation: Provider = { provide: NgbConfig, useValue: NO_ANIMATION_NGB_CONFIG };

export function toPage<T>(content: Array<T>, totalElements: number = content.length, num = 0, size = Math.max(20, totalElements)): Page<T> {
  return {
    content,
    totalElements,
    number: num,
    size,
    totalPages: Math.ceil(totalElements / size)
  };
}

export function emptyPage<T>(size = 20): Page<T> {
  return {
    totalElements: 0,
    content: [] as Array<T>,
    size,
    totalPages: 0,
    number: 0
  };
}
