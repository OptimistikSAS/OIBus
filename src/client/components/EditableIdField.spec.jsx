/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import EditableIdField from './EditableIdField.jsx'

// mock states
let initializing = 'editingId'
const editing = false
const setEditing = jest.fn()
const setEditingId = jest.fn()
const setOtherIds = jest.fn()
const setState = jest.fn()
React.useState = jest.fn().mockImplementation((init) => {
  if (init === false) {
    return [editing, setEditing]
  }
  if (init === undefined && initializing === 'editingId') {
    initializing = 'otherIds'
    return [init, setEditingId]
  }
  if (init === undefined && initializing === 'otherIds') {
    initializing = 'editingId'
    return [init, setOtherIds]
  }
  return [init, setState]
})

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

describe('EditableIdField', () => {
  test('check EditableIdField editing = false', () => {
    act(() => {
      root.render(<EditableIdField
        connectorName="id"
        fromList={[{ test: 'test' }]}
        editing={false}
        index={1}
        fieldName="name"
        valid={() => null}
        nameChanged={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })
  test('check EditableIdField editing = true', () => {
    act(() => {
      root.render(<EditableIdField
        connectorName="id"
        fromList={[{ test: 'test' }]}
        index={1}
        fieldName="name"
        editing
        valid={() => null}
        nameChanged={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })

  test('check editing done', () => {
    const idChanged = jest.fn()
    act(() => {
      root.render(<EditableIdField
        connectorName="id"
        fromList={[{ test: 'test' }]}
        index={1}
        fieldName="name"
        editing
        valid={() => null}
        nameChanged={idChanged}
      />)
    })
    Simulate.click(document.querySelector('#save-icon'))
    expect(idChanged).toBeCalled()
    expect(container).toMatchSnapshot()
  })

  test('check editing done with error', () => {
    const idChanged = jest.fn()
    act(() => {
      root.render(<EditableIdField
        connectorName="id"
        fromList={[{ test: 'test' }]}
        index={1}
        fieldName="name"
        editing
        valid={() => 'error'}
        nameChanged={idChanged}
      />)
    })
    Simulate.click(document.querySelector('#save-icon'))
    expect(idChanged).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
