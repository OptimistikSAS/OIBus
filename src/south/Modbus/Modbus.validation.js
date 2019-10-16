const validation = {
  Modbus: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    port: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    points: {
      pointId: (val) => ((val && val.length > 0) ? null : 'Point Id should not be empty'),
      address: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    },
  },
}

export default validation
