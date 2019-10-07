import type from '../../client/helpers/validation'

const validation = {
  OPCUA: {
    host: (val) => ((val && val.length > 2) ? null : 'Length should be greater than 2'),
    opcuaPort: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    httpsPort: (val) => (val >= 1 && val <= 65535 ? null : 'value should be between 1 and 65535'),
    endPoint: type.string,
    points: {
      pointId: type.string,
      ns: type.stringOrNumber,
      s: type.string,
    },
  },
}

export default validation
