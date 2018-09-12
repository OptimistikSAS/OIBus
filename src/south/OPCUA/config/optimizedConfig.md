
# OPCUA optimization
To complete

json object:
{
  "everySecond": {
    "SimulationServer": [
      { "OPCUAnodeId": { "ns": "5", "s": "Counter1" }, "pointId": "/fttest.base/Tank 5.tank/333333.temperature#value" },
      { "OPCUAnodeId": { "ns": "5", "s": "Random1" }, "pointId": "/fttest.base/Tank 5.tank/333333.temperature#quality" },
    ]
  },
  "everyNoon": {
    "SimulationServer": [
      { "OPCUAnodeId": { "ns": 5, "s": "Square1" }, "pointId": "/fttest.base/Tank 5.tank/333333.fill_level#value" },
    ]
  },
  .
  .
  .
}