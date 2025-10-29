import { Request } from 'express';
import { ScanModeService } from '../service/scan-mode.service';
import { CertificateService } from '../service/certificate.service';

interface CustomExpressRequest extends Request {
  services: {
    scanModeService: ScanModeService;
    certificateService: CertificateService;
  };
}
