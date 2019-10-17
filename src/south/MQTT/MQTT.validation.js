const validation = {
  MQTT: {
    server: (val) => ((val && val.length > 0) ? null : 'Server should not be empty'),
    port: (val) => (val >= 1 && val <= 65535 ? null : 'Value should be between 1 and 65535'),
    username: (val) => ((val && val.length > 0) ? null : 'Username should not be empty'),
    password: (val) => ((val && val.length > 0) ? null : 'Password should not be empty'),
    points: {
      pointId: (val) => ((val && val.length > 0) ? null : 'Point Id should not be empty'),
      topic: (val) => ((val && val.length > 0) ? null : 'Topic should not be empty'),
    },
  },
}

export default validation
