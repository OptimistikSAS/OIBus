import validation from './South.validation'

describe('South.validation', () => {
  it('check protocol.isValidName no error', () => {
    const error = validation.protocol.isValidName('new_name', ['name1', 'name2'])
    expect(error).toEqual(null)
  })
  it('check protocol.isValidName name already exists', () => {
    const error = validation.protocol.isValidName('name1', ['name1', 'name2'])
    expect(error).toEqual('Id already exists')
  })
  it('check protocol.isValidName name empty', () => {
    const error = validation.protocol.isValidName('', ['name1', 'name2'])
    expect(error).toBeTruthy()
  })
  it('check protocol.isValidName name int', () => {
    const error = validation.protocol.isValidName(1, ['name1', 'name2'])
    expect(error).toBeTruthy()
  })
})
