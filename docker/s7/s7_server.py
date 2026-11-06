"""Simulated Siemens S7 PLC for the OIBus S7 south connector, built on the Snap7 server (python-snap7).

Areas (rack 0, any slot, any connection type):
- DB1: fixed values of every supported data type (address in the comment of each line below), and 250 REAL at
  byte 200 (0.0, 0.5, 1.0, ...) to exercise the splitting of large reads into several PDUs.
- DB2: live values, refreshed every second: DINT counter at 0, REAL sine at 4, BOOL toggling at 8.0.
- Merkers: MB0 = 0x5A, M32.2 = true, MR4 = 1.25, MW8 = 4242.
- Inputs: IB0 = 0x0F, IW2 = 1000. Outputs: QB0 = 0xF0. Timers: T0..T7 = 0x1234 + n. Counters: C0..C7 = 0x0042 + n.
  The Snap7 server reads the timer / counter number of a request as a bit address (number / 8), unlike PLCs and
  the Snap7 client: T0 to T7 all return the value of T0, T8 to T15 the one of T1...
"""
import ctypes
import math
import os
import struct
import time

import snap7
from snap7.type import SrvArea


def area(size):
    return (ctypes.c_ubyte * size)()


def put(buffer, fmt, offset, *values):
    struct.pack_into('>' + fmt, memoryview(buffer).cast('B'), offset, *values)


def bcd(value):
    return ((value // 10) << 4) | (value % 10)


db1 = area(1200)
put(db1, 'f', 0, 3.14)  # DB1,REAL0
put(db1, 'h', 4, -1234)  # DB1,INT4
put(db1, 'i', 6, -123456789)  # DB1,DINT6
put(db1, 'H', 10, 0xBEEF)  # DB1,WORD10
put(db1, 'I', 12, 0xDEADBEEF)  # DB1,DWORD12
put(db1, 'B', 16, 0xA5)  # DB1,BYTE16 / DB1,X16.0 = true, DB1,X16.1 = false
put(db1, 'c', 17, b'Z')  # DB1,CHAR17
put(db1, 'BB5s', 18, 10, 5, b'hello')  # DB1,S18.10 (STRING[10])
put(db1, 'd', 30, 2.718281828)  # DB1,LREAL30
put(db1, '3f', 38, 1.5, 2.5, 3.5)  # DB1,REAL38.3
put(db1, '4h', 50, 1, 2, 3, 4)  # DB1,INT50.4
# DB1,DT58: 2024-03-15 12:34:56.789, friday (6)
put(db1, '8B', 58, bcd(24), bcd(3), bcd(15), bcd(12), bcd(34), bcd(56), bcd(78), (9 << 4) | 6)
# DB1,DTL66: 2024-03-15 12:34:56.789000000, friday (6)
put(db1, 'HBBBBBBI', 66, 2024, 3, 15, 6, 12, 34, 56, 789000000)
put(db1, 'b', 78, -5)  # DB1,SINT78
put(db1, 'B', 79, 250)  # DB1,USINT79
put(db1, 'H', 80, 65000)  # DB1,UINT80
put(db1, 'I', 82, 4000000000)  # DB1,UDINT82
put(db1, 'q', 86, -9000000000000000)  # DB1,LINT86
put(db1, 'Q', 94, 18000000000000000000)  # DB1,ULINT94
put(db1, '250f', 200, *[i * 0.5 for i in range(250)])  # DB1,REAL200.250

db2 = area(16)

mk = area(64)
put(mk, 'B', 0, 0x5A)  # MB0
put(mk, 'B', 32, 0b00000100)  # M32.2
put(mk, 'f', 4, 1.25)  # MR4
put(mk, 'H', 8, 4242)  # MW8

pe = area(16)
put(pe, 'B', 0, 0x0F)  # IB0
put(pe, 'H', 2, 1000)  # IW2

pa = area(16)
put(pa, 'B', 0, 0xF0)  # QB0

tm = area(16)
ct = area(16)
for n in range(8):
    put(tm, 'H', 2 * n, 0x1234 + n)
    put(ct, 'H', 2 * n, 0x0042 + n)

server = snap7.server.Server()
server.register_area(SrvArea.DB, 1, db1)
server.register_area(SrvArea.DB, 2, db2)
server.register_area(SrvArea.MK, 0, mk)
server.register_area(SrvArea.PE, 0, pe)
server.register_area(SrvArea.PA, 0, pa)
server.register_area(SrvArea.TM, 0, tm)
server.register_area(SrvArea.CT, 0, ct)
server.start(tcp_port=int(os.environ.get('S7_PORT', '102')))
print('S7 server started', flush=True)

counter = 0
while True:
    counter += 1
    put(db2, 'i', 0, counter)
    put(db2, 'f', 4, math.sin(counter / 10))
    put(db2, 'B', 8, counter % 2)
    time.sleep(1)
