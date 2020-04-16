import utils from './utils'

describe('utils', () => {
  it('check parseCSV correct', async () => {
    const result = await utils.parseCSV('a,b,c,d\n1,2,3,4')
    expect(result).toEqual([{ a: '1', b: '2', c: '3', d: '4' }])
  })
  it('check parseCSV error', async () => {
    utils.parseCSV('a,b,,c,d\n1,2,3,4').catch((error) => {
      expect(error).toBeTruthy()
    })
  })
})
