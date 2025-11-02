import { Request, Response, NextFunction } from 'express';
import SouthService from '../../service/south.service';
import NorthService from '../../service/north.service';
import OIBusService from '../../service/oibus.service';
import HomeMetricsService from '../../service/metrics/home-metrics.service';
import HistoryQueryService from '../../service/history-query.service';

interface SSEConfig {
  southService: SouthService;
  northService: NorthService;
  oIBusService: OIBusService;
  homeMetricsService: HomeMetricsService;
  historyQueryService: HistoryQueryService;
}

const createSSEMiddleware = (config: SSEConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if not an SSE endpoint
    if (!req.path.startsWith('/sse')) {
      return next();
    }

    // Set SSE headers
    req.socket.setKeepAlive(true);
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });

    try {
      if (req.path.startsWith('/sse/south/')) {
        const splitString = req.path.split('/');
        const stream = config.southService.getSouthDataStream(splitString[3])!;
        return stream.pipe(res);
      }

      if (req.path.startsWith('/sse/north/')) {
        const splitString = req.path.split('/');
        const stream = config.northService.getNorthDataStream(splitString[3])!;
        return stream.pipe(res);
      }

      if (req.path.startsWith('/sse/engine')) {
        const stream = config.oIBusService.stream;
        return stream.pipe(res);
      }

      if (req.path.startsWith('/sse/home')) {
        const stream = config.homeMetricsService.stream;
        return stream.pipe(res);
      }

      if (req.path.startsWith('/sse/history-queries/')) {
        const splitString = req.path.split('/');
        const stream = config.historyQueryService.getHistoryDataStream(splitString[3])!;
        return stream.pipe(res);
      }

      return next();
    } catch (error) {
      console.error('SSE Error:', error);
      res.status(500).end();
    }
  };
};

// Factory function to create the middleware with dependencies
export const sseMiddleware = (
  southService: SouthService,
  northService: NorthService,
  oIBusService: OIBusService,
  homeMetricsService: HomeMetricsService,
  historyQueryService: HistoryQueryService
) => {
  return createSSEMiddleware({
    southService,
    northService,
    oIBusService,
    homeMetricsService,
    historyQueryService
  });
};

export default sseMiddleware;
