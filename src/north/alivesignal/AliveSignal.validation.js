const validation = {
  AliveSignal: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    authentication: {
      username: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
      password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    },
    id: (val) => ((val && val.length > 0) ? null : 'ID should not be empty'),
    frequency: (val) => (val >= 1000 ? null : 'Frequency should be greater or equal to 1000'),
  },
}

export default validation
