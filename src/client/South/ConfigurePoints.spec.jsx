import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import ConfigurePoints from './ConfigurePoints.jsx'
import utils from '../helpers/utils'

// mock context
const dispatchNewConfig = jest.fn()
const setAlert = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert })
jest.mock('react-router-dom', () => (
  { useParams: jest.fn().mockReturnValue({ dataSourceId: 'OPC-HDA' }) }
))

// mock states
let filterText = ''
const setFilterText = jest.fn()
const setSelectedPage = jest.fn()
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === '') {
    return [filterText, setFilterText]
  }
  if (init === 1) {
    return [init, setSelectedPage]
  }
  return [init, setState]
})

// mock createCSV
let resolve
let reject
utils.createCSV = () => new Promise((_resolve, _reject) => {
  resolve = _resolve
  reject = _reject
})

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('ConfigurePoints', () => {
  test('check ConfigurePoints', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit filter input', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('filterText'), { target: { value: 'A13518/AI1/PV.CV' } })
    expect(setFilterText).toBeCalledWith('A13518/AI1/PV.CV')
    expect(container).toMatchSnapshot()
  })
  test('check render with filterText', () => {
    filterText = 'filter'
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    expect(container).toMatchSnapshot()
    filterText = ''
  })
  test('check add new point', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south.dataSources.7.points',
      value: {},
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first pointId', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('points.0.pointId'), { target: { value: 'new_point_id' } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.7.points.0.pointId',
      value: 'new_point_id',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first scanMode', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('points.0.scanMode'), { target: { value: 'everySecond' } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.7.points.0.scanMode',
      value: 'everySecond',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first pointId', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('points.0.pointId'), { target: { value: 'new_value' } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.7.points.0.pointId',
      value: 'new_value',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first scanMode', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('points.0.scanMode'), { target: { value: 'every1Min' } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.7.points.0.scanMode',
      value: 'every1Min',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check delete first point', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.querySelector('td path')) // click on delete icon
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'south.dataSources.7.points.0',
    })
    expect(container).toMatchSnapshot()
  })
  test('check import points press', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.getElementsByClassName('inline-button btn btn-primary')[0])
    expect(container).toMatchSnapshot()
  })
  test('check import points file input', () => {
    console.error = jest.fn()
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    expect(container).toMatchSnapshot()
  })
  test('check export points', () => {
    console.error = jest.fn()
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.getElementsByClassName('inline-button btn btn-primary')[1])
    expect(container).toMatchSnapshot()
  })
  test('check export points success', async () => {
    console.error = jest.fn()
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.getElementsByClassName('inline-button btn btn-primary')[1])
    expect(container).toMatchSnapshot()
    await act(async () => {
      resolve('test,csv')
    })
  })
  test('check export points fail', async () => {
    console.error = jest.fn()
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.getElementsByClassName('inline-button btn btn-primary')[1])
    expect(container).toMatchSnapshot()
    await act(async () => {
      reject('error')
    })
  })
  test('check pagination', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    const pagination = document.getElementsByClassName('pagination')[0]
    const items = pagination.getElementsByClassName('page-item')
    Simulate.click(items[0].querySelector('button'))
    expect(setSelectedPage).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check delete all points', () => {
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.getElementsByClassName('inline-button btn btn-danger')[0])
    expect(container).toMatchSnapshot()
  })
  test('check confirm on delete all points', () => {
    const originalMock = React.useState

    const setOpen = jest.fn()
    const confirm = jest.fn()
    const callback = jest.fn()
    callback.func = jest.fn().mockImplementation(() => confirm())
    React.useState = jest.fn().mockImplementation((init) => {
      if (init === false) {
        // set delete modal to be open
        return [true, setOpen]
      }
      if (init === null) {
        // set callback mock
        return [callback, setState]
      }
      return [init, setState]
    })

    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.getElementsByClassName('btn btn-primary')[2])
    expect(callback.func).toBeCalled()
    expect(confirm).toBeCalled()
    expect(container).toMatchSnapshot()
    React.useState = originalMock
  })
  test('check no config', () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig: null, dispatchNewConfig, setAlert })
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    expect(container).toMatchSnapshot()
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert })
  })
})
