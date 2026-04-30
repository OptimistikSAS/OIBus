import { Request, Response, NextFunction } from 'express';
import { testIPOnFilter } from '../../service/utils';
import type { ILogger } from '../../model/logger.model';

export default class IpFilterMiddleware {
  constructor(
    private whiteList: Array<string>,
    private logger: ILogger,
    private ignoreIpFilters: boolean
  ) {}

  public middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.ignoreIpFilters) {
        return next();
      }

      if (req.ip && testIPOnFilter(this.whiteList, req.ip)) {
        return next();
      }

      this.logger.error(new Error(`IP address ${req.ip} is not authorized.`));
      return res.status(401).send(`Access denied. IP ADDRESS ${req.ip} UNAUTHORIZED`);
    };
  }
}
