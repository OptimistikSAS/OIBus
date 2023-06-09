---
sidebar_position: 3
---

# Scan modes
Scan modes are Cron defined and used in OIBus to retrieve data at specific dates and interval from 
[South connectors](docs/guide/south-connectors/common-settings.md).

Four default scan modes are defined:
- everySecond
- every10Seconds
- every1Minute
- every10Minutes

You can define your own scan modes by adding one, giving it a name and selecting the _every_ option. Then, select the 
interval and the unit (msec, sec, minute, hour, day, week, month, year).

Under the hood, OIBus transforms these intervals into Cron. So naturally, Cron can be used to tune scan modes. To do so,
switch the _every_ option to _custom_, and type your Cron.

:::danger Specific cron syntax

The Cron in OIBus supports milliseconds cron, but with a reverse order:

`<year> <month> <day> <hour> <minute> <second> <millisecond>`

:::
