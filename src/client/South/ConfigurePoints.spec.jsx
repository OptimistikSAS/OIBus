/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { defaultConfig } from '../../../tests/testConfig'
import ConfigurePoints from './ConfigurePoints.jsx'
import utils from '../helpers/utils'

// mock context
const dispatchNewConfig = jest.fn()
const setAlert = jest.fn()
React.useContext = jest.fn().mockReturnValue({
  newConfig: {
    ...defaultConfig,
    south: {
      dataSources: [{
        id: 'south-uuid-1',
        name: 'TestOPCUA',
        protocol: 'OPCUA_HA',
        enabled: false,
        OPCUA_HA: {
          scanGroups: [
            { aggregate: 'Raw', resampling: 'None', scanMode: 'everySecond' },
            { aggregate: 'Raw', resampling: 'None', scanMode: 'every10Seconds' },
          ],
        },
        points: [
          { pointId: '111.temperature', nodeId: '111.temperature', scanMode: 'everySecond' },
          { pointId: '222.temperature', nodeId: '222.temperature', scanMode: 'everySecond' },
        ],
      }],
    },
  },
  dispatchNewConfig,
  setAlert,
})
jest.mock('react-router-dom', () => (
  {
    useParams: jest.fn().mockReturnValue({ id: 'south-uuid-1' }),
    useNavigate: jest.fn(),
  }
))

window.URL.createObjectURL = () => { }
// mock states
const originalUseState = React.useState
let filterText = ''
const setFilterText = jest.fn()
const setSelectedPage = jest.fn()
const setState = jest.fn()
const useStateMock = jest.fn().mockImplementation((init) => {
  if (init === '') {
    return [filterText, setFilterText]
  }
  if (init === 1) {
    return [init, setSelectedPage]
  }
  return [init, setState]
})
React.useState = useStateMock

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
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

describe('ConfigurePoints', () => {
  test('check ConfigurePoints', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit filter input', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('filterText'), { target: { value: 'A13518/AI1/PV.CV' } })
    })

    expect(setFilterText).toBeCalledWith('A13518/AI1/PV.CV')
    expect(container).toMatchSnapshot()
  })
  test('check render with filterText', () => {
    filterText = 'filter'
    act(() => {
      root.render(<ConfigurePoints />)
    })
    expect(container).toMatchSnapshot()
    filterText = ''
  })
  test('check add new point', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.click(document.querySelector('th path'))
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south.dataSources.0.points',
      value: {},
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first pointId', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('points.0.pointId'), { target: { value: 'new_point_id' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.0.points.1.pointId',
      value: 'new_point_id',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first scanMode', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('points.0.scanMode'), { target: { value: 'everySecond' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.0.points.1.scanMode',
      value: 'everySecond',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first pointId', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('points.0.pointId'), { target: { value: 'new_value' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.0.points.1.pointId',
      value: 'new_value',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first scanMode', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('points.0.scanMode'), { target: { value: 'every1Min' } })
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'south.dataSources.0.points.1.scanMode',
      value: 'every1Min',
      validity: null,
    })
    expect(container).toMatchSnapshot()
  })
  test('check import points press', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('inline-button btn btn-primary')[0])
    })

    expect(container).toMatchSnapshot()
  })
  test('check import points file input', () => {
    console.error = jest.fn()
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    })

    expect(container).toMatchSnapshot()
  })
  test('check import points readFileContent fail', async () => {
    console.error = jest.fn()

    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    })

    expect(container).toMatchSnapshot()
    // await utils.readFileContent
    await act(async () => {
      reject('error')
    })
  })
  test('check import points parseCSV fail', async () => {
    console.error = jest.fn()

    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    })
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
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.change(document.getElementById('importFile'), { target: { files: ['new_file'] } })
    })
    expect(container).toMatchSnapshot()
    // await utils.readFileContent
    await act(async () => {
      resolve('')
    })

    const newPoints = [
      { pointId: '111.temperature', nodeId: '111.temperature', scanMode: 'everySecond' },
      { pointId: '222.temperature', nodeId: '222.temperature', scanMode: 'everySecond' },
    ]

    // await utils.parseCSV to success
    await act(async () => {
      resolve(newPoints)
    })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'importPoints',
      name: 'south.dataSources.0.points',
      value: newPoints,
    })
  })
  test('check export points', async () => {
    console.error = jest.fn()
    const originalUrlCreateObjectURL = URL.createObjectURL
    URL.createObjectURL = jest.fn()
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('inline-button btn btn-primary')[1])
    })

    expect(container).toMatchSnapshot()
    await act(async () => {
      resolve('test,csv')
    })
    URL.createObjectURL = originalUrlCreateObjectURL
  })
  test('check pagination', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    const pagination = document.getElementsByClassName('pagination')[0]
    const items = pagination.getElementsByClassName('page-item')
    act(() => {
      Simulate.click(items[0].querySelector('button'))
    })

    expect(setSelectedPage).toBeCalledWith(1)
    expect(container).toMatchSnapshot()
  })
  test('check delete all points', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('inline-button btn btn-danger')[0])
    })

    expect(container).toMatchSnapshot()
  })
  test('check confirm on delete all points', () => {
    React.useState = originalUseState

    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('inline-button btn btn-danger')[0])
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('btn btn-primary')[2])
    })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteAllRows',
      name: 'south.dataSources.0.points',
    })
    expect(container).toMatchSnapshot()
  })
  test('check delete first point', () => {
    act(() => {
      root.render(<ConfigurePoints />)
    })
    act(() => {
      Simulate.click(document.querySelector('td path')) // click on delete icon
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('btn btn-primary')[3])
    })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'south.dataSources.0.points.1',
    })
    expect(container).toMatchSnapshot()
  })
  test('check no config', () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig: null, dispatchNewConfig, setAlert })
    act(() => {
      root.render(<ConfigurePoints />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check no points', () => {
    const configNoPoints = {
      ...defaultConfig,
      south: {
        dataSources: [{
          id: 'south-uuid-1',
          name: 'TestOPCUA',
          protocol: 'OPCUA_HA',
          enabled: false,
          OPCUA_HA: {
            scanGroups: [
              { Aggregate: 'Raw', resampling: 'None', scanMode: 'everySecond' },
              { Aggregate: 'Raw', resampling: 'None', scanMode: 'everySecond' },
            ],
          },
          points: undefined,
        }],
      },
    }
    React.useContext = jest.fn().mockReturnValue({ newConfig: configNoPoints, dispatchNewConfig, setAlert })
    act(() => {
      root.render(<ConfigurePoints />)
    })
    expect(container).toMatchSnapshot()
  })
})
