
# Modbus optimization
The Modbus driver will "compile" the configuration file in order to group together in a single request coils or registers close in the same range. The result will be a json object such as below:
```
{
  "everySecond": {
    "PLC-35": {}
      "coil": {
        "0-1024": [
          { "Modbus": { "address": "0x0f" }, "pointId": "/fttest.base/Tank 1.tank/111111.fill_level#value", "type": "number" },
          { "Modbus": { "address": "0x0031" }, "pointId": "/fttest.base/Tank 3.tank/333333.fill_level#value", "type": "number" }
        ]
      }
    }
  },
  "everyNoon": {
    "PLC-35": {
      "holdingRegister": {
        "240-1264": [{ "Modbus": { "address": "0x0f8" }, "pointId": "/fttest.base/Tank 2.tank/222222.fill_level#value", "type": "boolean" }]
      }
    }
  },
  "every15DaysAt9": {
    "PLC-35": {
      "coil": {
        "30352-31376": [{ "Modbus": { "address": "0x76a0" }, "pointId": "/fttest.base/Tank 2.tank/222222.fill_level#value", "type": "boolean" }],
        "33696-34704": [{ "Modbus": { "address": "0x83a6" }, "pointId": "/fttest.base/Tank 2.tank/111111.fill_level#value", "type": "boolean" }]
      }
    }
  }
}
```