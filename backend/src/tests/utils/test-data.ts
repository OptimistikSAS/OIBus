import { ScanMode } from '../../model/scan-mode.model';
import { ScanModeCommandDTO, ScanModeDTO } from '../../../../shared/model/scan-mode.model';

const scanModeCommandDTO: ScanModeCommandDTO = {
  name: 'my new scan mode',
  description: 'another scan mode',
  cron: '0 * * * * *'
};
const scanModes: Array<ScanMode> = [
  {
    id: 'id1',
    name: 'scanMode1',
    description: 'my first scanMode',
    cron: '* * * * * *'
  },
  {
    id: 'id2',
    name: 'scanMode2',
    description: 'my second scanMode',
    cron: '0 * * * * *'
  }
];
const scanModesDTO: Array<ScanModeDTO> = [
  {
    id: 'id1',
    name: 'scanMode1',
    description: 'my first scanMode',
    cron: '* * * * * *'
  },
  {
    id: 'id2',
    name: 'scanMode2',
    description: 'my second scanMode',
    cron: '0 * * * * *'
  }
];

export default Object.freeze({
  scanMode: {
    list: scanModes,
    dto: scanModesDTO,
    command: scanModeCommandDTO
  }
});
