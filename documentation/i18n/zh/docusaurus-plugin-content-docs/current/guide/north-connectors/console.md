---
sidebar_position: 6
---

# Console
The console is primarily employed for development and troubleshooting purposes.

## Specific settings
The console accepts just one option: `verbose`. When verbose mode is enabled, the received data is presented in detailed 
tables within the console. In contrast, with verbose mode disabled, only the count of values received by the North 
connector is displayed.

## Display Console in production
In a production environment, particularly on Windows or Linux, you might have OIBus running as a service. If you need 
to access the console output in such a scenario, you can follow these steps:
1. Stop the OIBus service.
2. Launch OIBus from a terminal with administrative access, directly from its installation folder:
   - On Windows: Execute the `go.bat` script.
   - On Linux: Run the `go.sh` script.

:::caution Restart the service
When you exit the terminal and wish to run OIBus as a service once more, remember to restart the service using the OS 
service manager.
:::