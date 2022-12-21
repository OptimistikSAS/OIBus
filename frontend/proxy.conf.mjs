const PROXY_CONFIG = [
  {
    // proxy all the requests starting with /api or /actuator to the Spring Boot backend
    context: ['/api', '/actuator'],
    target: 'http://localhost:2223',
    secure: false
  }
];

export default PROXY_CONFIG;
