const validation = {
  InfluxDB: {
    user: (val) => ((val && val.length > 0) ? null : 'User should not be empty'),
    password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    db: (val) => ((val && val.length > 0) ? null : 'Database should not be empty'),
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    precision: (val) => ((val && val.length > 0) ? null : 'Precision should not be empty'),
  },
}

export default validation
