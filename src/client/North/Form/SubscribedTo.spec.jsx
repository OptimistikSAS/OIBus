/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../../tests/testConfig.js'
import SubscribedTo from './SubscribedTo.jsx'

const dispatchNewConfig = jest.fn()
React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig })

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

testConfig.north.applications.forEach((application) => {
  describe('SubscribedTo', () => {
    test(`check SubscribedTo with application: ${application.name}`, () => {
      act(() => {
        root.render(<SubscribedTo
          subscribedTo={application.subscribedTo}
          applicationIndex={0}
        />)
      })
      expect(container).toMatchSnapshot()
    })
  })
})

const application = testConfig.north.applications[0]
describe('SubscribedTo click changes', () => {
  test('check SubscribedTo add row', () => {
    act(() => {
      root.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />)
    })
    act(() => {
      Simulate.click(document.querySelector('th path'))
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'north.applications.0.subscribedTo',
      value: testConfig.south.dataSources[0].id,
    })
    expect(container).toMatchSnapshot()
  })
  test('check SubscribedTo update row', () => {
    act(() => {
      root.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />)
    })
    act(() => (
      Simulate.change(document.getElementById('subscribedTo.0'), { target: { value: 'MQTTServer', selectedIndex: 0 } })
    ))

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'north.applications.0.subscribedTo.0',
      value: 'south-uuid-1',
    })
    expect(container).toMatchSnapshot()
  })
  test('check SubscribedTo delete first row', () => {
    act(() => {
      root.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />)
    })
    act(() => {
      Simulate.click(document.querySelector('td path'))
    })
    act(() => {
      Simulate.click(document.getElementsByClassName('btn btn-primary')[0])
    })

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
      root.render(<SubscribedTo
        subscribedTo={application.subscribedTo}
        applicationIndex={0}
      />)
    })
    expect(container).toMatchSnapshot()
  })
})
