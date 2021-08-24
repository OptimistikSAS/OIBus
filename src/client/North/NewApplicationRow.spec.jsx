/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import * as nanoid from 'nanoid'
import testConfig from '../../../tests/testConfig'
import NewApplicationRow from './NewApplicationRow.jsx'

// mocking the nanoid method
jest.mock('nanoid')
jest.spyOn(nanoid, 'nanoid').mockReturnValue('generated-uuid')

// mocking state updates
let name = ''
const setName = jest.fn().mockImplementation((newValue) => {
  name = newValue
})
let api = testConfig.apiList[0]
const setApi = jest.fn().mockImplementation((newValue) => {
  api = newValue
})
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === '') {
    return [name, setName]
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
    Simulate.change(document.getElementById('name'), { target: { value: '' } })
    Simulate.click(document.querySelector('div button'))
    expect(container).toMatchSnapshot()
  })
  test('check change application name', () => {
    act(() => {
      ReactDOM.render(
        <NewApplicationRow
          apiList={testConfig.apiList}
          addApplication={() => (1)}
        />, container,
      )
    })
    Simulate.change(document.getElementById('name'), { target: { value: 'new_application' } })
    expect(setName).toBeCalledWith('new_application')
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
    expect(addApplication).toBeCalledWith({ id: 'generated-uuid', name, api })
    expect(container).toMatchSnapshot()
  })
})
