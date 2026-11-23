const PROXY_CONFIG = [
  {
    // proxy all the requests starting with /api to the NodeJS backend
    // note: we need to add the /sse path for the server sent events
    context: ['/api', '/sse'],
    // a new OIBus serves HTTPS with a self-signed certificate: set OIBUS_BACKEND_URL=http://localhost:2223 for one serving HTTP
    target: process.env.OIBUS_BACKEND_URL || 'https://localhost:2223',
    secure: false
  }
];

export default PROXY_CONFIG;
