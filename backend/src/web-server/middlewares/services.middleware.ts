import { Request, Response, NextFunction } from 'express';
import ScanModeService from '../../service/scan-mode.service';
import CertificateService from '../../service/certificate.service';
import { CustomExpressRequest } from '../express';

export function createInjectServicesMiddleware(scanModeService: ScanModeService, certificateService: CertificateService) {
  return (req: Request, res: Response, next: NextFunction) => {
    (req as CustomExpressRequest).services = {
      scanModeService,
      certificateService
    };
    return next();
  };
}
