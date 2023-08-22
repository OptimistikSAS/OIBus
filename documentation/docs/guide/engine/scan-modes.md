---
sidebar_position: 2
---

# Scan modes
Scan modes are Cron defined and used in OIBus to retrieve or send data at specific dates and interval from 
[South connectors](../../guide/south-connectors/common-settings.md).

Six default scan modes are defined:
- Every second (* * * * * *)
- Every 10 seconds (*/10 * * * * *)
- Every minute (0 * * * * *)
- Every 10 minutes (0 */10 * * * *)
- Every hour (0 0 * * * *)
- Every 24 hours (0 0 0 * * *)

You can define your own scan modes by adding one, giving it a name and specifying your Cron. you can test your Cron
expression on https://crontab.cronhub.io/.