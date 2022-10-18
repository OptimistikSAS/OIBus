import validation from './north.validation'

describe('North.validation', () => {
  it('check caching.sendInterval no error', () => {
    const error = validation.caching.sendInterval(1000)
    expect(error).toEqual(null)
  })
  it('check caching.sendInterval error', () => {
    const error = validation.caching.sendInterval(999)
    expect(error).toBeTruthy()
  })
  it('check caching.retryInterval no error', () => {
    const error = validation.caching.retryInterval(1000)
    expect(error).toEqual(null)
  })
  it('check caching.retryInterval error', () => {
    const error = validation.caching.retryInterval(999)
    expect(error).toBeTruthy()
  })
  it('check caching.groupCount no error', () => {
    const error = validation.caching.groupCount(1)
    expect(error).toEqual(null)
  })
  it('check caching.groupCount error', () => {
    const error = validation.caching.groupCount(0)
    expect(error).toBeTruthy()
  })
  it('check caching.maxSendCount no error', () => {
    const error = validation.caching.maxSendCount(1)
    expect(error).toEqual(null)
  })
  it('check caching.maxSendCount error', () => {
    const error = validation.caching.maxSendCount(0)
    expect(error).toBeTruthy()
  })
  it('check north.isValidName no error', () => {
    const error = validation.north.isValidName('new_name', ['name1', 'name2'])
    expect(error).toEqual(null)
  })
  it('check north.isValidName name already exists', () => {
    const error = validation.north.isValidName('name1', ['name1', 'name2'])
    expect(error).toEqual('Name already exists')
  })

  it('check north.isValidName name int', () => {
    const error = validation.north.isValidName(1, ['name1', 'name2'])
    expect(error).toBeTruthy()
  })
})
