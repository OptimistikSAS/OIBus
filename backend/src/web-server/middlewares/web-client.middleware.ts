import path from 'path';
import express from 'express';

const webClientMiddleware = () => {
  const root = path.join(__dirname, '../../../../frontend/browser');
  const staticMiddleware = express.static(root, {
    index: false, // Don't serve index.html automatically for directory requests
    extensions: false // Don't try to add extensions to files
  });

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`webClientMiddleware: ${req.method} ${req.path}`);

    if (req.path.match(/\.(js|js\.map|ico|ttf|css|css\.map|png|svg|woff|woff2)$/)) {
      console.log('Serving static file');
      staticMiddleware(req, res, next);
      return;
    } else if (!req.path.startsWith('/api/') && !req.path.startsWith('/sse/') && req.method === 'GET') {
      console.log('Serving index.html');
      return res.sendFile(path.join(root, 'index.html'));
    } else {
      console.log('Continuing to next middleware');
      return next();
    }
  };
};

export default webClientMiddleware;
