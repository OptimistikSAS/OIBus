const schema = {
  name: 'TimescaleDB',
  supportPoints: true,
  category: 'DatabaseIn',
}
schema.form = {
  TimescaledbParameters: {
    type: 'OIbTitle',
    label: 'Timescale parameters',
    children: `
      <div>
        <p>Send points data to Timescale Database</p>
        <p>
          Please enter here required information to access the database.
        </p>
      </div>
    `,
  },
  user: {
    type: 'OIbText',
    valid: 'notEmpty',
    defaultValue: '',
  },
  password: {
    type: 'OIbPassword',
    newRow: false,
    valid: 'hasLengthBetween(0, 256)',
    defaultValue: '',
  },
  host: {
    type: 'OIbText',
    valid: 'notEmpty',
    defaultValue: '',
    help: 'The host is only the postgresql server with port separated by &ldquo;:&ldquo; character (it not includes postgres:// protocol)</div>',
  },
  db: {
    type: 'OIbText',
    newRow: false,
    label: 'Database',
    valid: 'notEmpty',
    defaultValue: '',
  },
  pointIdParameters: {
    type: 'OIbTitle',
    children: `
      <div>
        <p>Regexp will be used to identify token in the pointId that will be used to build the TimescaleDB query.</p>
        <ul>
          <li>
            {'(.*)\\/(.{2})(.)(.*)'}
            This example will split into 4 groups: MMMMM/SSNCCC...CC gives %1=MMMMM %2=SS %3=N %4=CCC...CC
          </li>
          <li>(.*) This example will split into 1 group: MMMMM/SSNCCC...CC gives %1=MMMMM/SSNCCC...CC</li>
        </ul>
      </div>
    `,
  },
  regExp: {
    type: 'OIbText',
    valid: 'notEmpty',
    defaultValue: '(.*)',
    help: `
      <div>
        For example (.*)\\/(.
        {2}
        )(.)(.*) to split in 4 groups
      </div>`,
  },
  table: {
    type: 'OIbText',
    valid: 'notEmpty',
    defaultValue: '%1$s',
  },
  optFields: {
    type: 'OIbText',
    defaultValue: '',
    valid: 'hasLengthBetween(0, 256)',
    newRow: false,
    help: 'Field(s) extracted from pointID, for example, site:%2$s,unit:%3$s,sensor:%4$s</div>',
  },
  timestampPathInDataValue: {
    type: 'OIbText',
    defaultValue: '',
    valid: 'optional',
    newRow: false,
    help: 'Timestamp field extracted from the JSON object (empty means the JSON &quot;timestamp&quot; field is used)</div>',
  },
  valueParameters: {
    type: 'OIbTitle',
    children: `
      <div>
        <p>data value to process by north connector is a Json object which contains :  </p>
        <ul>
          <li>
            value can be a simple data (integer or float or string, etc...) or can be a Json object
          </li>
          <li>
            quality is a string which indicate the quality (good/bad) of value
          </li>
        </ul>
        <p>When value is Json object it can be written in two format: </p>
        <ul>
          <li>
            based on only one level (Json containing keys/values as simple data)
            (example : &lbrace;&ldquo;key1&ldquo;:xxxx, key2:&ldquo;xxxxx&ldquo; ...&rbrace;)
          </li>
          <li>
            based on more than one level (Json containing at min one key/value as Json object)
            (example : &lbrace;&ldquo;key1&ldquo;:&lbrace;jsonObject&rbrace; ...&lbrace;)
          </li>
        </ul>
        <p>To simplify the oibus configuration and to make difference between the formats, presented above, we use two parameters: </p>
        <ul>
          <li>
            useDataKeyValue: boolean value
            <ul>
              <li>
                when checked means we use value key of data Json object (but not the quality key)
              </li>
              <li>
                when unchecked means we use data Json object (value and quality keys)
              </li>
            </ul>
          </li>
        </ul>
        <ul>
          <li>
            keyParentValue: string value
            <ul>
              <li>
                an empty string indicates that Json object is based on a Json with only one level
              </li>
              <li>
                a non empty string indicates the key of Json object based on a Json with more than one level
              </li>
            </ul>
          </li>
        </ul>
      </div>
    `,
  },
  useDataKeyValue: {
    type: 'OIbCheckBox',
    valid: 'notEmpty',
    label: 'use key "value" of Json "data"',
    help: 'When checked, means that the field &quot;value&quot; will be parsed as JSON object</div>',
    defaultValue: false,
  },
  keyParentValue: {
    type: 'OIbText',
    valid: 'optional',
    defaultValue: '',
    help: 'Indicates which field of the JSON object contains the value (empty means the JSON &quot;data&quot; field is used)</div>',
  },
}

module.exports = schema
