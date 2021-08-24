/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import * as nanoid from 'nanoid'
import testConfig from '../../../tests/testConfig'
import NewDataSourceRow from './NewDataSourceRow.jsx'

// mocking the nanoid method
jest.mock('nanoid')
jest.spyOn(nanoid, 'nanoid').mockReturnValue('generated-uuid')

// mocking state updates
let name = ''
const setName = jest.fn().mockImplementation((newValue) => {
  name = newValue
})
let protocol = testConfig.protocolList[0]
const setProtocol = jest.fn().mockImplementation((newValue) => {
  protocol = newValue
})
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === '') {
    return [name, setName]
  }
  if (init === testConfig.protocolList[0]) {
    return [protocol, setProtocol]
  }
  return [init, setState]
})

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('NewDataSourceRow', () => {
  test('check NewDataSourceRow', () => {
    act(() => {
      ReactDOM.render(
        <NewDataSourceRow
          protocolList={testConfig.protocolList}
          addDataSource={() => (1)}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check add pressed with empty dataSource name', () => {
    const addDataSource = jest.fn()
    act(() => {
      ReactDOM.render(
        <NewDataSourceRow
          protocolList={testConfig.protocolList}
          addDataSource={addDataSource}
        />, container,
      )
    })
    Simulate.change(document.getElementById('name'), { target: { value: '' } })
    Simulate.click(document.querySelector('div button'))
    expect(container).toMatchSnapshot()
  })
  test('check change dataSource name', () => {
    act(() => {
      ReactDOM.render(
        <NewDataSourceRow
          protocolList={testConfig.protocolList}
          addDataSource={() => (1)}
        />, container,
      )
    })
    Simulate.change(document.getElementById('name'), { target: { value: 'new_datasource' } })
    expect(setName).toBeCalledWith('new_datasource')
    expect(container).toMatchSnapshot()
  })
  test('check change protocol', () => {
    act(() => {
      ReactDOM.render(
        <NewDataSourceRow
          protocolList={testConfig.protocolList}
          addDataSource={() => (1)}
        />, container,
      )
    })
    Simulate.change(document.getElementById('protocol'), { target: { value: 'Modbus', selectedIndex: 4 } })
    expect(setProtocol).toBeCalledWith('Modbus')
    expect(container).toMatchSnapshot()
  })
  test('check add press', () => {
    const addDataSource = jest.fn()
    act(() => {
      ReactDOM.render(
        <NewDataSourceRow
          protocolList={testConfig.protocolList}
          addDataSource={addDataSource}
        />, container,
      )
    })
    Simulate.click(document.querySelector('div button'))
    expect(addDataSource).toBeCalledWith({ id: 'generated-uuid', name, protocol })
    expect(container).toMatchSnapshot()
  })
})
