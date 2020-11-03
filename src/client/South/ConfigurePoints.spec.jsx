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
const originalUseState = React.useState
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
// mock parseCSV
utils.parseCSV = () => new Promise((_resolve, _reject) => {
  resolve = _resolve
  reject = _reject
})

utils.readFileContent = () => new Promise((_resolve, _reject) => {
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
      name: 'south.dataSources.8.points',
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
      name: 'south.dataSources.8.points.2.pointId',
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
      name: 'south.dataSources.8.points.2.scanMode',
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
      name: 'south.dataSources.8.points.2.pointId',
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
      name: 'south.dataSources.8.points.2.scanMode',
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
      name: 'south.dataSources.8.points.2',
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
  test('check import points readFileContent fail', async () => {
    console.error = jest.fn()

    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    expect(container).toMatchSnapshot()
    // await utils.readFileContent
    await act(async () => {
      reject('error')
    })
  })
  test('check import points parseCSV fail', async () => {
    console.error = jest.fn()

    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    expect(container).toMatchSnapshot()
    // await utils.readFileContent
    await act(async () => {
      resolve('')
    })
    // await utils.parseCSV to fail
    await act(async () => {
      reject('error')
    })
  })
  test('check import points success', async () => {
    console.error = jest.fn()

    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    expect(container).toMatchSnapshot()
    // await utils.readFileContent
    await act(async () => {
      resolve('')
    })

    const newPoints = newConfig.south.dataSources[0].points
    // await utils.parseCSV to success
    await act(async () => {
      resolve(newPoints)
    })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'importPoints',
      name: 'south.dataSources.8.points',
      value: newPoints,
    })
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
    const originalUrlCreateObjectURL = URL.createObjectURL
    URL.createObjectURL = jest.fn()
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
    URL.createObjectURL = originalUrlCreateObjectURL
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
  test('check no points', () => {
    const configNoPoints = utils.jsonCopy(newConfig)
    configNoPoints.south.dataSources[8].points = undefined
    React.useContext = jest.fn().mockReturnValue({ newConfig: configNoPoints, dispatchNewConfig, setAlert })
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    expect(container).toMatchSnapshot()
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert })
  })
  test('check confirm on delete all points', () => {
    React.useState = originalUseState
    act(() => {
      ReactDOM.render(
        <ConfigurePoints />, container,
      )
    })
    Simulate.click(document.getElementsByClassName('inline-button btn btn-danger')[0])
    Simulate.click(document.getElementsByClassName('btn btn-primary')[2])
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteAllRows',
      name: 'south.dataSources.8.points',
    })
    expect(container).toMatchSnapshot()
  })
})
