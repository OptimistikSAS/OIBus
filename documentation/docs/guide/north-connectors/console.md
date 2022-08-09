---
sidebar_position: 6
---

# Console
The console is mainly used for development or troubleshooting purposes.

It only accepts one option: **verbose**. When verbose is enabled, received data are fully displayed in tables in
the console. Otherwise, only the number of values received by this North connector is displayed.

## Display Console in production
In production, specially on Windows or Linux, you may have OIBus running as a service. In this case, to see the 
console output:
- Stop the service
- Run OIBus from a terminal with admin access from its installation folder:
  - On Windows: run `go.bat` script 
  - On Linux: run `go.sh` script
