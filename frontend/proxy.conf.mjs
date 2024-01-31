const PROXY_CONFIG = [
  {
    // proxy all the requests starting with /api to the NodeJS backend
    // note: we need to add the /sse path for the server sent events
    context: ['/api', '/sse'],
    target: 'http://localhost:2223',
    secure: false
  }
];

export default PROXY_CONFIG;
