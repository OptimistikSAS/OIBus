import type from '../../client/helpers/validation'

const validation = {
  Modbus: {
    host: type.string,
    port: type.number,
    points: {
      pointId: type.string,
      address: type.string,
    },
  },
}

export default validation
