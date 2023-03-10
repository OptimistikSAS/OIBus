import getNumberOfWords from './utils.js'

describe('South connector Modbus utils', () => {
  it('should retrieve number of words', () => {
    expect(getNumberOfWords('UInt16')).toEqual(1)
    expect(getNumberOfWords('Int16')).toEqual(1)
    expect(getNumberOfWords('UInt32')).toEqual(2)
    expect(getNumberOfWords('Int32')).toEqual(2)
    expect(getNumberOfWords('Float')).toEqual(2)
    expect(getNumberOfWords('BigUInt64')).toEqual(4)
    expect(getNumberOfWords('BigInt64')).toEqual(4)
    expect(getNumberOfWords('Double')).toEqual(4)
    expect(getNumberOfWords('other')).toEqual(1)
  })
})
