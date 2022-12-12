import React from 'react'
import PropTypes from 'prop-types'
import { ConfigProvider } from './config-context.jsx'

const ConfigProviders = ({ children }) => (
  <ConfigProvider>
    {children}
  </ConfigProvider>
)

ConfigProviders.propTypes = { children: PropTypes.element.isRequired }
export default ConfigProviders
