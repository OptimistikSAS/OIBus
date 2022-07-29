import React from 'react'
import PropTypes from 'prop-types'

import apis from '../services/apis'

const SchemaContext = React.createContext({})

const SchemaProvider = ({ children }) => {
  const [northSchemas, setNorthSchemas] = React.useState()
  const [southSchemas, setSouthSchemas] = React.useState()
  /**
   * Acquire the list of API
   * @returns {void}
   */
  React.useEffect(() => {
    const call = async () => {
      try {
        setNorthSchemas(await apis.getNorthSchemas())
      } catch (error) {
        console.error(error)
      }
    }
    call()
  }, [])

  /**
   * Acquire the list of Protocols
   * @returns {void}
   */
  React.useEffect(() => {
    const call = async () => {
      try {
        setSouthSchemas(await apis.getSouthSchemas())
      } catch (error) {
        console.error(error)
      }
    }
    call()
  }, [])
  const configValueProvided = React.useMemo(
    () => ({ northSchemas, southSchemas }),
    [northSchemas, southSchemas],
  )
  return (
    <SchemaContext.Provider value={configValueProvided}>
      {children}
    </SchemaContext.Provider>
  )
}
SchemaProvider.propTypes = { children: PropTypes.node.isRequired }

export { SchemaContext, SchemaProvider }
