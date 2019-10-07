import type from '../../client/helpers/validation'

const validation = {
  Modbus: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    port: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    points: {
      pointId: type.string,
      address: type.string,
    },
  },
}

export default validation
