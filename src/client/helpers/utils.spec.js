import utils from './utils'

// fixing date to match snapshot
const RealDate = Date
const realToLocaleString = global.Date.prototype.toLocaleString
const constantDate = new Date(Date.UTC(2020, 1, 1, 0, 0, 0))
// Ensure test output is consistent across machine locale and time zone config.
const mockToLocaleString = () => constantDate.toUTCString()
global.Date.prototype.toLocaleString = mockToLocaleString

describe('utils', () => {
  it('check readFileContent', async () => {
    const result = await utils.readFileContent(new Blob())
    expect(result).toEqual('')
  })
  it('check jsonCopy', () => {
    const result = utils.jsonCopy({ a: 1, b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })
  it('check parseCSV correct', async () => {
    const result = await utils.parseCSV('a,b,c,d\n1,2,3,4')
    expect(result).toEqual([{ a: '1', b: '2', c: '3', d: '4' }])
  })
  it('check parseCSV error', async () => {
    await utils.parseCSV('a,b,c\n1,2,3,4', { headers: true, strictColumnHandling: false }).catch((error) => {
      expect(error).toBeTruthy()
    })
  })
  it('check createCSV', async () => {
    const result = await utils.createCSV([{ a: '1', b: '2', c: '3', d: '4' }])
    expect(result).toEqual('a,b,c,d\n1,2,3,4')
  })
  it('check replaceValues', () => {
    const object = { a: 'value', b: 'value' }
    utils.replaceValues(object, ['a'], 'newValue')
    expect(object).toEqual({ a: 'newValue', b: 'value' })
  })
  it('check replaceValues with array content', () => {
    const object = { a: ['value1', 'value2'], b: 'value' }
    utils.replaceValues(object, ['a'], ['newValue1', 'newValue2'])
    expect(object).toEqual({ a: ['newValue1', 'newValue2'], b: 'value' })
  })
  it('check replaceValues for difference', () => {
    const object = { a: 'value', b: 'value' }
    utils.replaceValues(object, ['a'], 'newValue', true)
    expect(object).toEqual({ a: ['newValue', 'newValue'], b: 'value' })
  })
  it('check replaceValues for difference with new value number as string', () => {
    const object = { a: 'value', b: 'value' }
    utils.replaceValues(object, ['a'], '1', true)
    expect(object).toEqual({ a: ['1', '1'], b: 'value' })
  })
  it('check replaceValues undefined object', () => {
    const object = undefined
    utils.replaceValues(object, ['a'], 'newValue')
    expect(object).toEqual(undefined)
  })
  it('check replaceValues undefined object for difference', () => {
    const object = undefined
    utils.replaceValues(object, ['a'], 'newValue', true)
    expect(object).toEqual(undefined)
  })
  it('check replaceValues empty object', () => {
    const object = {}
    utils.replaceValues(object, ['a'], 'newValue')
    expect(object).toEqual({})
  })
  it('check replaceValues empty object for difference', () => {
    const object = {}
    utils.replaceValues(object, ['a'], 'newValue', true)
    expect(object).toEqual({})
  })
  it('check nextTime with string value', () => {
    const result = utils.nextTime('string')
    expect(result).toEqual('')
  })
  it('check nextTime with null value', () => {
    const result = utils.nextTime(null)
    expect(result).toEqual('')
  })
  it('check nextTime with string value', () => {
    const result = utils.nextTime('string')
    expect(result).toEqual('')
  })
  it('check nextTime with * * *', () => {
    const result = utils.nextTime('* * *')
    expect(result).toEqual('Next occurrence: Sat, 01 Feb 2020 00:00:00 GMT')
    global.Date = RealDate
    global.Date.prototype.toLocaleString = realToLocaleString
  })
})
