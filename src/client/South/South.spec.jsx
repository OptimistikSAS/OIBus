import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import South from './South.jsx'

const dispatchNewConfig = jest.fn((link) => link)
const setAlert = jest.fn()
const sort = {
  setSortSouthBy: jest.fn(),
  setIsSouthAscending: jest.fn(),
}
React.useContext = jest.fn().mockReturnValue({ newConfig, protocolList: newConfig.protocolList, dispatchNewConfig, setAlert, sort })

const mockHistoryPush = jest.fn()
jest.mock('react-router-dom', () => (
  { useHistory: () => ({ push: mockHistoryPush }) }
))

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('South', () => {
  test('check South', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check press edit first dataSource id', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    Simulate.click(document.querySelector('td path'))
    expect(container).toMatchSnapshot()
  })
  test('check edit first dataSource id', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    Simulate.click(document.querySelector('td path'))
    Simulate.change(document.querySelector('td input'), { target: { value: 'new_id' } })
    Simulate.click(document.querySelector('td path'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.0.dataSourceId',
      value: 'new_id',
    })
    expect(container).toMatchSnapshot()
  })
  test('check delete first dataSource', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    const firstApplicationButtons = document.querySelectorAll('td')[4]
    Simulate.click(firstApplicationButtons.querySelector('path'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'south.dataSources.0',
    })
    expect(container).toMatchSnapshot()
  })
  test('check open edit first application', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    const firstApplicationButtons = document.querySelectorAll('td')[4]
    Simulate.click(firstApplicationButtons.querySelectorAll('path')[1])
    expect(mockHistoryPush).toBeCalledWith({ pathname: `/south/${newConfig.south.dataSources[0].dataSourceId}` })
    expect(container).toMatchSnapshot()
  })
  test('check duplicate first dataSource', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    const firstApplicationButtons = document.querySelectorAll('td')[4]
    const duplicateButton = firstApplicationButtons.querySelectorAll('path')[3]
    Simulate.click(duplicateButton)
    const dataSource = newConfig.south.dataSources[0]
    const newName = `${dataSource.dataSourceId} copy`
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south.dataSources',
      value: {
        ...dataSource,
        dataSourceId: newName,
        enabled: false,
      },
    })
    expect(container).toMatchSnapshot()
  })
  test('check duplicate first dataSource with countCopies', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    const thirdApplicationButtons = document.querySelectorAll('td')[14]
    const duplicateButton = thirdApplicationButtons.querySelectorAll('path')[3]
    Simulate.click(duplicateButton)
    const dataSource = newConfig.south.dataSources[2]
    const newName = `${dataSource.dataSourceId} copy2`
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south.dataSources',
      value: {
        ...dataSource,
        dataSourceId: newName,
        enabled: false,
      },
    })
    expect(container).toMatchSnapshot()
  })
  test('check add pressed with "new_datasource" id', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    Simulate.change(document.getElementById('dataSourceId'), { target: { value: 'new_datasource' } })
    Simulate.click(document.querySelector('form div div button'))
    expect(container).toMatchSnapshot()
  })
  test('check add pressed with already existing id', () => {
    const originalError = console.error
    console.error = jest.fn()
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    Simulate.change(document.getElementById('dataSourceId'), { target: { value: newConfig.south.dataSources[0].dataSourceId } })
    try {
      Simulate.click(document.querySelector('form div div button'))
    } catch (e) {
      expect(e.message).toBe('data source already exists')
    }
    console.error = originalError
  })
  test('check sort pressed on dataSourceId', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    const firstHeader = document.querySelectorAll('th')[0]
    Simulate.click(firstHeader.querySelectorAll('path')[1])
    expect(container).toMatchSnapshot()
  })
  test('check sort pressed on dataSourceId ascending', () => {
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    const firstHeader = document.querySelectorAll('th')[0]
    Simulate.click(firstHeader.querySelectorAll('path')[0])
    expect(container).toMatchSnapshot()
  })
  test('check missing protocolList', () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check with sortBy=dataSourceId', () => {
    sort.sortSouthBy = 'dataSourceId'
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check with sortBy=protocol', () => {
    sort.sortSouthBy = 'protocol'
    sort.isSouthAscending = true
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check with missing dataSources', () => {
    newConfig.south.dataSources = null
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <South />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
