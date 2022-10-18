const utils = require('./utils')

describe('South connector Modbus utils', () => {
  it('should retrieve number of words', () => {
    expect(utils.getNumberOfWords('UInt16')).toEqual(1)
    expect(utils.getNumberOfWords('Int16')).toEqual(1)
    expect(utils.getNumberOfWords('UInt32')).toEqual(2)
    expect(utils.getNumberOfWords('Int32')).toEqual(2)
    expect(utils.getNumberOfWords('Float')).toEqual(2)
    expect(utils.getNumberOfWords('BigUInt64')).toEqual(4)
    expect(utils.getNumberOfWords('BigInt64')).toEqual(4)
    expect(utils.getNumberOfWords('Double')).toEqual(4)
    expect(utils.getNumberOfWords('other')).toEqual(1)
  })
})
