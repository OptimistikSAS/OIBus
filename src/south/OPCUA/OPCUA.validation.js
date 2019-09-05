import type from '../../client/helpers/validation'

const validation = {
  OPCUA: {
    host: type.string,
    opcuaPort: type.number,
    httpsPort: type.number,
    endPoint: type.string,
    points: {
      pointId: type.string,
      ns: type.number,
      s: type.string,
    },
  },
}

export default validation
