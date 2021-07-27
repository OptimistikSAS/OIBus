/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import EditableIdField from './EditableIdField.jsx'

// mock states
let initializing = 'editingId'
let editing = false
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
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('EditableIdField', () => {
  test('check EditableIdField editing = false', () => {
    act(() => {
      ReactDOM.render(<EditableIdField
        id="id"
        fromList={[{ test: 'test' }]}
        index={1}
        name="name"
        valid={() => null}
        idChanged={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check EditableIdField editing = true', () => {
    editing = true
    act(() => {
      ReactDOM.render(<EditableIdField
        id="id"
        fromList={[{ test: 'test' }]}
        index={1}
        name="name"
        valid={() => null}
        idChanged={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check editing done', () => {
    const idChanged = jest.fn()
    act(() => {
      ReactDOM.render(<EditableIdField
        id="id"
        fromList={[{ test: 'test' }]}
        index={1}
        name="name"
        valid={() => null}
        idChanged={idChanged}
      />, container)
    })
    Simulate.click(document.querySelector('button svg path'))
    expect(idChanged).toBeCalled()
    expect(container).toMatchSnapshot()
  })
  test('check editing done with error', () => {
    const idChanged = jest.fn()
    act(() => {
      ReactDOM.render(<EditableIdField
        id="id"
        fromList={[{ test: 'test' }]}
        index={1}
        name="name"
        valid={() => 'error'}
        idChanged={idChanged}
      />, container)
    })
    Simulate.click(document.querySelector('button svg path'))
    expect(idChanged).not.toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
