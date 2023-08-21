---
displayed_sidebar: developerSidebar
sidebar_position: 3
---

# Create a new OIBus connector
Connectors, both North and South, are written in [TypeScript](https://www.typescriptlang.org/). It allows you to create your
own connector while being sure to match OIBus type structures and method calls.

The connectors source files are located in the `backend/src` folder, either in `north` or in `south`. Most of them are
composed of three files:
- **A manifest**: this file is a JSON where you describe all the fields of your connector and how some basic settings of OIBus
will apply or not with the connector
- **A class file**: That's where all your logic goes. Connection methods, retrieval or sending of data...
- **A test file**: Tests are mandatory, specially if you want to be sure that future changes won't break your logic. Be sure
that your test coverage is 100%.

Some may have more files to implement protocol-specific logic in another file and better testing.

:::tip
Please contact us if you don't know where to start with your development! Maybe what you seek can also be done as an 
improvement of an existing North or South connector.
:::

## The manifest
With this JSON, you can specify what fields are required to configure your connector, what type of fields, etc...
- **id**: The id of your manifest (must not be used by another manifest)
- **name**: The name used for display
- **category**: The type of manifest. Existing categories are: `iot`, `api`, `database`, `file`. 
- **description**: What your connector does, briefly summarized.
- **modes**: How your connector will integrate with OIBus.
  - For South
    - subscription: Can your connector subscribe ? If so, it must implements `QueriesSubscription` class. 
    - lastPoint: Can your connector request a point ? If so the value will be retrieved as JSON payload and the connector must implement the `QueriesLastPoint` interface.
    - lastFile: Can your connector request a file ? If so, the connector must implement the `QueriesFile` interface.
    - history: Can your connector request a history ? If so, the connector must implement the `QueriesHistory` interface. 
    - If true, it will be possible to create history queries from your connector type.
  - For North
    - files: Can manage files. If so, the connector must implement the `HandlesFile` interface.
    - points: Can manage JSON payload. If so, the connector must implement the `HandlesValues` interface.
- settings: An array of settings which represents the inputs to configure your connector. See the [settings section](#settings)
- items (South only): A section to describe how to configure the items to query
  - scanMode:
    - acceptSubscription: Is it possible to use subscription for an item? Example: OPCUA
    - subscriptionOnly: Is subscription the only choice for each item? Example: MQTT 
  - settings: An array of settings which represents the inputs to configure your item. See the [settings section](#settings)

### Settings
All settings have common fields, used for display or validation. These common fields are:
- **Main fields**
  - **key**: The field, written in `camelCase`
  - **type**: One of the type described below, starting with the `Oib` prefix
  - **defaultValue** (optional): must match the type (string, number, boolean...)
- **Display settings**
  - **label**: What to display in the form 
  - **pipe** (optional): A pipe to translate the options
  - **unitLabel** (optional): The unit of the value
  - **newRow**: Should this input start a new row?
  - **class**: Bootstrap compatible CSS classes, mainly used to display each input in the row with `col-4`, `col`, etc.
  - **displayInViewMode**: Should this input be shown on the display page of a connector 
- **Validation**
  - conditionalDisplay: The other field to monitor according to which the current field is displayed or not. The validators apply only 
if the current field is displayed. See example below.
  - validators: An array of [Angular validators](https://angular.io/api/forms/Validators). See example below

```json title="Conditional display example"
{
  "field": "authentication", "values": ["basic"]
}
```
```json title="Validator example"
[{
  "key": "required"
},
{
  "key": "maxLength",
  "params": {
    "maxLength": 50
  }
}]
```

Then, each type of fields comes with its frontend logic and backend type safety. Some types add more fields.

#### OibText
Create an input of type text in the frontend, and a field of type `string` in the TypeScript model.

#### OibTextArea
Create a textarea input in the frontend, and a field of type `string` in the TypeScript model.

#### OibCodeBlock
Create a code block with [monaco editor](https://microsoft.github.io/monaco-editor/) in the frontend, and a field of type
`string` in the TypeScript model.
Additional field:
- contentType: The language to set up the editor on the frontend (example: `sql`, `json`).

#### OibNumber
Create an input of type number in the frontend, and a field of type `number` in the TypeScript model.

#### OibSelect
Create an input of type select in the frontend, and a field of type `string` in the TypeScript model.
Additional field:
- options: The options to display in the select

#### OibSecret
Create an input of type password in the frontend, and a field of type `string` in the TypeScript model.
This field does not show what is typed in the frontend, and indicate OIBus [to encrypt the 
input](../guide/advanced/oibus-security.md#oibus-security)

#### OibCheckbox
Create an input of type checkbox in the frontend (customized in a toggle), and a field of type `boolean` in the TypeScript 
model.

#### OibTimezone
Create an input of type select in the frontend, and a field of type `string` in the TypeScript model. The options are the 
available timezones.

#### Group settings
It is possible to group settings together, inside a structure or inside an array. 

##### OibArray
OibArray will be displayed... as an array where you can add or delete rows: each row will have the fields described in 
the **content** fields. See the `dateTimeFields` builder as an example.

##### OibFormGroup
Group settings in another structure. Specially useful to apply a `conditonalDisplay` to a group of settings, and add other
`conditionalDisplays` inside the structure

### Items
The items form (create, or update) can be called from the Item array of the display or edit page of a South connector.
All items must have a name, a scanMode (that can be hidden if it only accepts subscription) and [specific settings described
in the manifest](#settings).

### Create or update your data types
If you create a new connector, add it in the `buildSouthInterfaceName` or `buildNorthInterfaceName` method of the 
`settings-interface.generator.ts` file.

Once your manifest is ready, you can generate the appropriate types by running in the `backend` folder:
```
npm run generate-settings-interface
``` 

This command will parse all the manifest files found in the `backend` folder and create the TypeScript types according 
to each field description.

You will be able to call them with the customized name `South<ConnectorType>Settings` and `South<ConnectorType>ItemSettings`.

:::caution 
Once the command has run, if the types have changed, the next run will fail. You will have to update your code to adapt 
it to the new types first.
:::