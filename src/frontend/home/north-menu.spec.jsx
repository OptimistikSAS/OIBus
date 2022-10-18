/**
 * @jest-environment jsdom
 */
import React from 'react'
import * as nanoid from 'nanoid'
import { act, Simulate } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import NorthMenu from './north-menu.jsx'
import { testConfig } from '../../../tests/test-config'

// mocking the nanoid method
jest.mock('nanoid')
jest.spyOn(nanoid, 'nanoid').mockReturnValue('generated-uuid')

const dispatchNewConfig = jest.fn((link) => link)

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => (
  { useNavigate: () => mockNavigate }
))

const north = testConfig.north[0]

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig, dispatchNewConfig })
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
  jest.clearAllMocks()
})

describe('NorthMenu', () => {
  test('display NorthMenu properly when empty newConfig', async () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig: null, dispatchNewConfig })

    act(() => {
      root.render(
        <NorthMenu north={north} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: {}, dispatchNewConfig })

    act(() => {
      root.render(
        <NorthMenu north={north} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { north: {} }, dispatchNewConfig })

    act(() => {
      root.render(
        <NorthMenu north={north} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { north: [] }, dispatchNewConfig })

    act(() => {
      root.render(
        <NorthMenu north={north} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('display NorthMenu page based on config', async () => {
    act(() => {
      root.render(
        <NorthMenu north={north} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate north', () => {
    act(() => {
      root.render(<NorthMenu north={north} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-duplicate'))
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'north',
      value: {
        ...north,
        name: 'TestConsole copy',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate north already copied', () => {
    const northWithCopyInName = north
    northWithCopyInName.name = 'TestConsole copy'

    act(() => {
      root.render(<NorthMenu north={northWithCopyInName} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-duplicate'))
    })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'north',
      value: {
        ...northWithCopyInName,
        name: 'TestConsole copy copy',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check edit first north', () => {
    act(() => {
      root.render(<NorthMenu north={north} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-settings'))
    })
    expect(mockNavigate).toBeCalledWith(`/north/${testConfig.north[0].id}`)
    expect(container).toMatchSnapshot()
  })

  test('check status first north', () => {
    act(() => {
      root.render(<NorthMenu north={north} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-status'))
    })
    expect(mockNavigate).toBeCalledWith(`/north/${testConfig.north[0].id}/live`)
    expect(container).toMatchSnapshot()
  })

  test('check delete first north', () => {
    act(() => {
      root.render(<NorthMenu north={north} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-delete'))
    })
    act(() => {
      Simulate.click(document.getElementById('confirm'))
    })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'deleteRow',
      name: 'north.0',
    })
    expect(container).toMatchSnapshot()
  })

  test('check cancel delete first north', () => {
    act(() => {
      root.render(<NorthMenu north={north} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-delete'))
    })
    act(() => {
      Simulate.click(document.getElementById('cancel'))
    })
    expect(dispatchNewConfig).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
