const validation = {
  OIConnect: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    endpoint: (val) => ((val && val.length > 0) ? null : 'End point should not be empty'),
    authentication: {
      username: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
      password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    },
    timeout: (val) => (val >= 1000 ? null : 'Timeout should be greater or equal to 1000'),
  },
}

export default validation
