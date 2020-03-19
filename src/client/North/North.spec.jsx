import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import newConfig from '../../../tests/testConfig'
import North from './North.jsx'

const dispatchNewConfig = jest.fn((link) => link)
React.useContext = jest.fn().mockReturnValue({ newConfig, apiList: newConfig.apiList, dispatchNewConfig })

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
    Simulate.click(firstApplicationButtons.querySelector('path'))
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
    Simulate.click(firstApplicationButtons.querySelectorAll('path')[1])
    expect(mockHistoryPush).toBeCalledWith({ pathname: `/north/${newConfig.north.applications[0].applicationId}` })
    expect(container).toMatchSnapshot()
  })
})
