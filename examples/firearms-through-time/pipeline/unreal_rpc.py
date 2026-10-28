"""Small direct MCP client for bounded local Unreal qualification calls.

No automatic mutation retries. Each invocation negotiates a fresh session.
Usage: python unreal_rpc.py tools/list --out evidence/catalog.json
       python unreal_rpc.py tools/call --params-file request.json --out response.json
"""
import argparse
import json
from pathlib import Path
import urllib.request


class UnrealRPC:
    def __init__(self, endpoint="http://127.0.0.1:8000/mcp", timeout=120):
        self.endpoint, self.timeout = endpoint, timeout
        self.session = None
        self.counter = 0
        self.protocol = "2025-03-26"

    def request(self, method, params=None, notification=False):
        self.counter += 1
        payload = {"jsonrpc": "2.0", "method": method}
        if not notification:
            payload["id"] = self.counter
        if params is not None:
            payload["params"] = params
        headers = {"Content-Type": "application/json", "Accept": "application/json, text/event-stream"}
        if self.session:
            headers["Mcp-Session-Id"] = self.session
            headers["MCP-Protocol-Version"] = self.protocol
        req = urllib.request.Request(self.endpoint, json.dumps(payload).encode(), headers)
        with urllib.request.urlopen(req, timeout=self.timeout) as response:
            self.session = response.headers.get("Mcp-Session-Id", self.session)
            content_type = response.headers.get("Content-Type", "")
            if "text/event-stream" in content_type:
                for raw in response:
                    line = raw.decode().strip()
                    if line.startswith("data:"):
                        obj = json.loads(line[5:])
                        if obj.get("id") == payload.get("id"):
                            break
                else:
                    raise RuntimeError("MCP event stream ended without matching response")
            else:
                body = response.read()
                obj = json.loads(body) if body else {}
        if "error" in obj:
            raise RuntimeError(json.dumps(obj["error"]))
        return obj.get("result", obj)

    def initialize(self):
        result = self.request("initialize", {"protocolVersion": self.protocol, "capabilities": {}, "clientInfo": {"name": "workspace-qualification", "version": "0.1.0"}})
        self.protocol = result.get("protocolVersion", self.protocol)
        self.request("notifications/initialized", notification=True)
        return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("method")
    parser.add_argument("--params-file", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    client = UnrealRPC()
    identity = client.initialize()
    result = client.request(args.method, json.loads(args.params_file.read_text(encoding="utf-8-sig")) if args.params_file else {})
    receipt = {"server": identity, "method": args.method, "result": result}
    args.out.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    if result.get("isError"):
        raise SystemExit("Unreal tool returned isError; inspect saved response")
    print(json.dumps(receipt, indent=2))
