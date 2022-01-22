const testHistoryConfig = [
  {
    id: 'bulk-id-1',
    name: 'MSSQL South -> OIAnalytics North',
    startTime: '2021-10-15T14:18',
    endTime: '2021-10-16T14:18',
    filePattern: 'history1-@CurrentDate.csv',
    compress: true,
    southId: 'southId-1',
    northId: 'northId-1',
    order: 2,
    query: 'SELECT timestamp,temperature FROM history WHERE timestamp >= @StartTime AND timestamp <= @EndTime',
    points: [
      {
        pointId: 'A13518/AI1/PV.CV',
        scanMode: 'everySecond',
      },
      {
        pointId: '_FC42404/PID1/OUT.CV',
        scanMode: 'everySecond',
      },
      {
        pointId: '_FC42404/PID1/PV.CV',
        scanMode: 'every10Seconds',
      },
    ],
    enabled: true,
    paused: true,
    status: 'exporting',
  },
  {
    id: 'bulk-id-2',
    name: 'MSSQL South -> Console',
    startTime: '2021-10-15T14:18',
    endTime: '2021-10-16T14:18',
    filePattern: 'history1-@CurrentDate.csv',
    compress: true,
    southId: 'southId-2',
    northId: 'northId-2',
    order: 1,
    query: 'SELECT timestamp,temperature FROM history WHERE timestamp >= @StartTime AND timestamp <= @EndTime',
    points: [],
    enabled: true,
    paused: true,
    status: 'pending',
  },
]

export default testHistoryConfig
