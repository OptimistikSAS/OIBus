const PROXY_CONFIG = [
  {
    // proxy all the requests starting with /api to the NodeJS backend
    context: ['/api'],
    target: 'http://localhost:2223',
    secure: false
  }
];

export default PROXY_CONFIG;
