#!/bin/bash

curl --location --request POST 'http://localhost:2223/api/ip-filters' \
--header 'Content-Type: application/json' \
--data-raw '{
    "address": "*",
    "description": "All"
}' \
-u "admin:pass"
