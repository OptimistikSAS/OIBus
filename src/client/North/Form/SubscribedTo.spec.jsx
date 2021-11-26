/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import newConfig from '../../../../tests/testConfig'
import SubscribedTo from './SubscribedTo.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig })

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

newConfig.north.applications.forEach((application) => {
  describe('SubscribedTo', () => {
    test(`check SubscribedTo with application: ${application.name}`, () => {
      act(() => {
        ReactDOM.render(<SubscribedTo
          subscribedTo={application.subscribedTo}
          applicationIndex={0}
        />, container)
      })
      expect(container).toMatchSnapshot()
    })
  })
})

const application = newConfig.north.applications[0]
describe('SubscribedTo click changes', () => {
  test('check SubscribedTo add row', () => {
    act(() => {
      ReactDOM.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />, container)
    })
    Simulate.click(document.querySelector('th path'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'north.applications.0.subscribedTo',
      value: newConfig.south.dataSources[0].id,
    })
    expect(container).toMatchSnapshot()
  })
  test('check SubscribedTo update row', () => {
    act(() => {
      ReactDOM.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />, container)
    })
    Simulate.change(document.getElementById('subscribedTo.0'), { target: { value: 'MQTTServer', selectedIndex: 0 } })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'north.applications.0.subscribedTo.0',
      value: 'datasource-uuid-1',
    })
    expect(container).toMatchSnapshot()
  })
  test('check SubscribedTo delete first row', () => {
    act(() => {
      ReactDOM.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />, container)
    })
    Simulate.click(document.querySelector('td path'))
    Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'north.applications.0.subscribedTo.0',
    })
    expect(container).toMatchSnapshot()
  })
})

describe('SubscribedTo no dataSources', () => {
  test('check SubscribedTo with no dataSources', () => {
    React.useContext = jest.fn().mockReturnValue({ dispatchNewConfig })
    act(() => {
      ReactDOM.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
