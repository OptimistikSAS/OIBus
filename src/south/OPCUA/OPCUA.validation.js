const validation = {
  OPCUA: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    opcuaPort: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    httpsPort: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    endPoint: (val) => ((val && val.length > 0) ? null : 'End Point should not be empty'),
    points: {
      pointId: (val) => ((val && val.length > 0) ? null : 'Point Id should not be empty'),
      ns: (val) => (((val && val.length > 0) || val > 0) ? null : 'Value should not be empty'),
      s: (val) => ((val && val.length > 0) ? null : 'Value should not be empty'),
    },
  },
}

export default validation
