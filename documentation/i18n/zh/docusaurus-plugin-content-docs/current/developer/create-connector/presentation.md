---
displayed_sidebar: developerSidebar
sidebar_position: 1
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
