#!/usr/bin/env python3
"""
Minimal RFC 5424 syslog receiver for testing OIBus's syslog logger transport.

Listens on UDP and TCP (same port) and prints every received message to stdout,
so received logs can be inspected with `docker logs -f oibus_syslog-server`.

Env vars:
  SYSLOG_PORT  port to listen on for both UDP and TCP (default: 514)
"""
import os
import socketserver
import threading

PORT = int(os.getenv("SYSLOG_PORT", 514))


class UDPHandler(socketserver.BaseRequestHandler):
    def handle(self):
        data = self.request[0].decode(errors="replace").strip()
        print(f"[udp] {data}", flush=True)


class TCPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        for line in self.rfile:
            print(f"[tcp] {line.decode(errors='replace').strip()}", flush=True)


class ThreadingUDPServer(socketserver.ThreadingMixIn, socketserver.UDPServer):
    allow_reuse_address = True


class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True


def main():
    udp_server = ThreadingUDPServer(("0.0.0.0", PORT), UDPHandler)
    tcp_server = ThreadingTCPServer(("0.0.0.0", PORT), TCPHandler)

    print(f"[syslog] Listening on UDP/TCP port {PORT} ...", flush=True)
    threading.Thread(target=udp_server.serve_forever, daemon=True).start()
    tcp_server.serve_forever()


if __name__ == "__main__":
    main()
