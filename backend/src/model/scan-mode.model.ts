import { BaseEntity } from './types';

export interface ScanMode extends BaseEntity {
  name: string;
  description: string;
  cron: string;
}
