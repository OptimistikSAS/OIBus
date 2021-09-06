import validation from './South.validation'
import testConfig from '../../../../tests/testConfig'

describe('South.validation', () => {
  it('check protocol.isValidName no error', () => {
    const error = validation.protocol.isValidName('new_name', ['name1', 'name2'])
    expect(error).toEqual(null)
  })
  it('check protocol.isValidName name already exists', () => {
    const error = validation.protocol.isValidName('name1', ['name1', 'name2'])
    expect(error).toEqual('Name already exists')
  })
  it('check protocol.isValidName name int', () => {
    const error = validation.protocol.isValidName(1, ['name1', 'name2'])
    expect(error).toBeTruthy()
  })
  it('check scanMode.isSelectedOnce no error', () => {
    const error = validation.scanMode.isSelectedOnce('value', 'south.dataSources.1.OPCUA_HA.scanGroups.0.scanMode', testConfig)
    expect(error).toEqual(null)
  })
  it('check scanMode.isSelectedOnce already exists', () => {
    const error = validation.scanMode.isSelectedOnce('everySecond', 'south.dataSources.1.OPCUA_HA.scanGroups.1.scanMode', testConfig)
    expect(error).toBeTruthy()
  })
})
