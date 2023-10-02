---
sidebar_position: 3
---

# IP Filters
By default, only local access is permitted.

If you wish to access OIBus from a remote workstation, you can add a remote address. It's important to ensure that the 
IP address format is correctly specified, whether it's IPv4 or IPv6. OIBus supports both formats.


When you install OIBus from a script, within a Docker container, or for other use cases, it can be valuable to permit access 
from remote IP addresses. You can execute the following curl command using the default credentials and port:
```curl title="curl command"
curl --location --request POST 'http://localhost:2224/api/ip-filters' \
--header 'Content-Type: application/json' \
--data-raw '{
    "address": "*",
    "description": "All"
}' \
-u "admin:pass"
```