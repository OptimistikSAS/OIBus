import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import North from './North.jsx'

const dispatchNewConfig = jest.fn((link) => link)
const setAlert = jest.fn()
const sort = {
  setSortNorthBy: jest.fn(),
  setIsNorthAscending: jest.fn(),
}
React.useContext = jest.fn().mockReturnValue({ newConfig, apiList: newConfig.apiList, dispatchNewConfig, setAlert, sort })

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

describe('North', () => {
  test('check North', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check press edit first application id', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    Simulate.click(document.querySelector('td path'))
    expect(container).toMatchSnapshot()
  })
  test('check press edit first application id', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    Simulate.click(document.querySelector('td path'))
    Simulate.change(document.querySelector('td input'), { target: { value: 'new_id' } })
    Simulate.click(document.querySelector('td path'))
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'update',
      name: 'north.applications.0.applicationId',
      value: 'new_id',
    })
    expect(container).toMatchSnapshot()
  })
  test('check delete first application', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    const firstApplicationButtons = document.querySelectorAll('td')[3]
    Simulate.click(firstApplicationButtons.querySelectorAll('path')[1])
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'north.applications.0',
    })
    expect(container).toMatchSnapshot()
  })
  test('check edit first application', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    const firstApplicationButtons = document.querySelectorAll('td')[3]
    Simulate.click(firstApplicationButtons.querySelectorAll('path')[0])
    expect(mockHistoryPush).toBeCalledWith({ pathname: `/north/${newConfig.north.applications[0].applicationId}` })
    expect(container).toMatchSnapshot()
  })
  test('check add pressed with "new_application" id', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    Simulate.change(document.getElementById('applicationId'), { target: { value: 'new_application' } })
    Simulate.click(document.querySelector('form div div button'))
    expect(container).toMatchSnapshot()
  })
  test('check add pressed with already existing id', () => {
    const originalError = console.error
    console.error = jest.fn()
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    Simulate.change(document.getElementById('applicationId'), { target: { value: newConfig.north.applications[0].applicationId } })
    try {
      Simulate.click(document.querySelector('form div div button'))
    } catch (e) {
      expect(e.message).toBe('application already exists')
    }
    console.error = originalError
  })
  test('check sort pressed on applicationId', () => {
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    const firstHeader = document.querySelectorAll('th')[0]
    Simulate.click(firstHeader.querySelectorAll('path')[1])
    expect(container).toMatchSnapshot()
  })
  test('check missing apiList', () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check with sortBy=applicationId', () => {
    sort.sortNorthBy = 'applicationId'
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check with sortBy=api', () => {
    sort.sortNorthBy = 'api'
    sort.isNorthAscending = true
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
  test('check with missing applications', () => {
    newConfig.north.applications = null
    React.useContext = jest.fn().mockReturnValue({ newConfig, dispatchNewConfig, setAlert, sort })
    act(() => {
      ReactDOM.render(
        <North />, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
