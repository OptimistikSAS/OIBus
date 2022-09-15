/**
 * @jest-environment jsdom
 */
import React from 'react'
import * as nanoid from 'nanoid'
import { act, Simulate } from 'react-dom/test-utils'
import * as ReactDOMClient from 'react-dom/client'
import SouthMenu from './SouthMenu.jsx'
import { testConfig } from '../../../tests/testConfig'

// mocking the nanoid method
jest.mock('nanoid')
jest.spyOn(nanoid, 'nanoid').mockReturnValue('generated-uuid')

const dispatchNewConfig = jest.fn((link) => link)

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => (
  { useNavigate: () => mockNavigate }
))

const dataSource = testConfig.south[0]

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

describe('SouthMenu', () => {
  test('display SouthMenu properly when empty newConfig', async () => {
    React.useContext = jest.fn().mockReturnValue({ newConfig: null, dispatchNewConfig })

    act(() => {
      root.render(
        <SouthMenu dataSource={dataSource} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: {}, dispatchNewConfig })

    act(() => {
      root.render(
        <SouthMenu dataSource={dataSource} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { south: {} }, dispatchNewConfig })

    act(() => {
      root.render(
        <SouthMenu dataSource={dataSource} />,
      )
    })
    expect(container).toMatchSnapshot()

    React.useContext = jest.fn().mockReturnValue({ newConfig: { south: [] }, dispatchNewConfig })

    act(() => {
      root.render(
        <SouthMenu dataSource={dataSource} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('display SouthMenu page based on config', async () => {
    act(() => {
      root.render(
        <SouthMenu dataSource={dataSource} />,
      )
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate dataSource', async () => {
    act(() => {
      root.render(<SouthMenu dataSource={dataSource} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-duplicate'))
    })
    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south',
      value: {
        ...dataSource,
        name: 'TestFolderScanner copy',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check duplicate dataSource already copied', async () => {
    const dataSourceWithCopyInName = dataSource
    dataSourceWithCopyInName.name = 'TestFolderScanner copy'

    act(() => {
      root.render(<SouthMenu dataSource={dataSourceWithCopyInName} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-duplicate'))
    })

    expect(dispatchNewConfig).toBeCalledWith({
      type: 'addRow',
      name: 'south',
      value: {
        ...dataSourceWithCopyInName,
        name: 'TestFolderScanner copy copy',
        enabled: false,
        id: 'generated-uuid',
      },
    })
    expect(container).toMatchSnapshot()
  })

  test('check edit first dataSource', () => {
    act(() => {
      root.render(<SouthMenu dataSource={dataSource} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })

    act(() => {
      Simulate.click(document.getElementById('oi-settings'))
    })
    expect(mockNavigate).toBeCalledWith(`/south/${testConfig.south[0].id}`)
    expect(container).toMatchSnapshot()
  })

  test('check status first dataSource', () => {
    act(() => {
      root.render(<SouthMenu dataSource={dataSource} />)
    })
    act(() => {
      Simulate.click(document.getElementById('dropdown-toggle'))
    })
    act(() => {
      Simulate.click(document.getElementById('oi-status'))
    })

    expect(mockNavigate).toBeCalledWith(`/south/${testConfig.south[0].id}/live`)
    expect(container).toMatchSnapshot()
  })

  test('check delete first dataSource', () => {
    act(() => {
      root.render(<SouthMenu dataSource={dataSource} />)
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
      name: 'south.0',
    })
    expect(container).toMatchSnapshot()
  })

  test('check cancel delete first dataSource', () => {
    act(() => {
      root.render(<SouthMenu dataSource={dataSource} />)
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
