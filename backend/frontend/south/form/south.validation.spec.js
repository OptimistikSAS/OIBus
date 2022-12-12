import validation from './south.validation.js'

describe('South.validation', () => {
  it('check south.isValidName no error', () => {
    const error = validation.south.isValidName('new_name', ['name1', 'name2'])
    expect(error).toEqual(null)
  })
  it('check south.isValidName name already exists', () => {
    const error = validation.south.isValidName('name1', ['name1', 'name2'])
    expect(error).toEqual('Name already exists')
  })
  it('check south.isValidName name int', () => {
    const error = validation.south.isValidName(1, ['name1', 'name2'])
    expect(error).toBeTruthy()
  })
})
