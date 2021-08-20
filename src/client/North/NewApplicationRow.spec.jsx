/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import * as uuid from 'uuid'
import testConfig from '../../../tests/testConfig'
import NewApplicationRow from './NewApplicationRow.jsx'

// mocking the uuid method
jest.mock('uuid')
jest.spyOn(uuid, 'v4').mockReturnValue('generated-uuid')

// mocking state updates
let applicationId = ''
const setApplicationId = jest.fn().mockImplementation((newValue) => {
  applicationId = newValue
})
let api = testConfig.apiList[0]
const setApi = jest.fn().mockImplementation((newValue) => {
  api = newValue
})
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === '') {
    return [applicationId, setApplicationId]
  }
  if (init === testConfig.apiList[0]) {
    return [api, setApi]
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

describe('NewApplicationRow', () => {
  test('check NewApplicationRow', () => {
    act(() => {
      ReactDOM.render(
        <NewApplicationRow
          apiList={testConfig.apiList}
          addApplication={() => (1)}
        />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check add pressed with empty application name', () => {
    const addApplication = jest.fn()
    act(() => {
      ReactDOM.render(
        <NewApplicationRow
          apiList={testConfig.apiList}
          addApplication={addApplication}
        />, container,
      )
    })
    Simulate.change(document.getElementById('applicationId'), { target: { value: '' } })
    Simulate.click(document.querySelector('div button'))
    expect(container).toMatchSnapshot()
  })
  test('check change applicationId', () => {
    act(() => {
      ReactDOM.render(
        <NewApplicationRow
          apiList={testConfig.apiList}
          addApplication={() => (1)}
        />, container,
      )
    })
    Simulate.change(document.getElementById('applicationId'), { target: { value: 'new_application' } })
    expect(setApplicationId).toBeCalledWith('new_application')
    expect(container).toMatchSnapshot()
  })
  test('check change api', () => {
    act(() => {
      ReactDOM.render(
        <NewApplicationRow
          apiList={testConfig.apiList}
          addApplication={() => (1)}
        />, container,
      )
    })
    Simulate.change(document.getElementById('api'), { target: { value: 'OIConnect', selectedIndex: 1 } })
    expect(setApi).toBeCalledWith('OIConnect')
    expect(container).toMatchSnapshot()
  })
  test('check add press', () => {
    const addApplication = jest.fn()
    act(() => {
      ReactDOM.render(
        <NewApplicationRow
          apiList={testConfig.apiList}
          addApplication={addApplication}
        />, container,
      )
    })
    Simulate.click(document.querySelector('div button'))
    expect(addApplication).toBeCalledWith({ id: 'generated-uuid', applicationId, api })
    expect(container).toMatchSnapshot()
  })
})
