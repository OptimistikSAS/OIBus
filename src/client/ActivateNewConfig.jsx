import React from 'react'
import { Label, Button } from 'reactstrap'
import { ReactGhLikeDiff } from 'react-gh-like-diff'
import stringify from 'json-stable-stringify'
import 'react-gh-like-diff/lib/diff2html.min.css'
import apis from './services/apis'


const ActivateNewConfig = () => {
  const [configActiveJson, setConfigActiveJson] = React.useState(null)
  const [configJson, setConfigJson] = React.useState(null)

  /**
   * Acquire the Active configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getActiveConfig().then(({ config }) => {
      setConfigActiveJson(config)
    })
  }, [])

  /**
   * Acquire the Current Modified configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setConfigJson(config)
    })
  }, [])

  /**
   * Check if modified is changed compared to active
   * @param {string} active The current active config JSON string
   * @param {string} modified The current modified config JSON string
   * @returns {boolean} compare result
   */
  const compareActiveWithModified = (active, modified) => (active && modified && (active !== modified))

  /**
   * Activate new configuration
   * @returns {void}
   */
  const handleActivate = async () => {
    try {
      await apis.updateActiveConfig()
      setConfigActiveJson(configJson)
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Reset modified configuration
   * @returns {void}
   */
  const handleDecline = async () => {
    try {
      await apis.resetModifiedConfig()
      setConfigJson(configActiveJson)
    } catch (error) {
      console.error(error)
    }
  }

  // json-stable-stringify is used instead of JSON.stringify to have consistent result in alphabetical order
  const activeString = stringify(configActiveJson, { space: '  ' })
  const modifiedString = stringify(configJson, { space: '  ' })
  const isModified = compareActiveWithModified(activeString, modifiedString)

  return (
    <>
      {isModified
        ? (
          <>
            <ReactGhLikeDiff
              options={{
                originalFileName: 'Configuration',
                updatedFileName: 'Configuration',
              }}
              past={activeString}
              current={modifiedString}
            />
            <Button color="primary" onClick={() => handleActivate()}>
              Activate
            </Button>
            <Button color="primary" onClick={() => handleDecline()}>
              Decline
            </Button>
          </>
        )
        : <Label>No modifications on configuration</Label>
      }
    </>
  )
}

export default ActivateNewConfig
