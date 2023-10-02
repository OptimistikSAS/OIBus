---
sidebar_position: 2
---

# Scan modes
Cron-defined scan modes are utilized in OIBus to retrieve or send data from 
[South connectors](../../guide/south-connectors/common-settings.md) at specific dates and intervals.

There are six default scan modes:
- Every second: (* * * * * *)
- Every 10 seconds: (/10 * * * *)
- Every minute: (0 * * * * *), running every minute at precisely 0 seconds.
- Every 10 minutes: (0 /10 * * *), running every 10 minutes at precisely 0 seconds.
- Every hour: (0 0 * * * *), running every hour at precisely 0 seconds.
- Every 24 hours: (0 0 0 * * *), running every day at midnight exactly.

You have the option to create your custom scan modes by adding one, assigning it a name, and specifying the Cron expression. 
You can test your Cron expression using the following website: https://crontab.cronhub.io/.