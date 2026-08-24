using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json.Nodes;
using OSIsoft.AF.Asset;
using OSIsoft.AF.Data;
using OSIsoft.AF.PI;
using OSIsoft.AF.Time;

// A single process shared by every OIBus south-pi connector in the running OIBus instance (see
// @oibus/pi-afsdk-windows's PiBridge/PiConnection). Unlike OLE DB, there is only ever ONE underlying
// PI server connection per machine — OSIsoft.AF.PI.PIServers().DefaultPIServer, the server configured
// via the PI System client tools on this host — matching OIBusAgentWindows's own PIService, which was
// already a process-wide singleton regardless of which south connector called it. Logical connection
// `id`s are still tracked (mirroring the OLE DB helper's shape for consistency and future-proofing,
// e.g. if named-server support is ever added) but all of them share the one real `PIServer`.
//
// `disconnect` intentionally does NOT tear down the underlying PI connection — neither did
// OIBusAgentWindows's own PIController.Disconnect(), which is a no-op. Reconnecting to a PI server is
// comparatively expensive, so the connection is kept alive for the life of this process once
// established; only the logical `id` bookkeeping is cleared.
//
// Commands on the same connection id run in the order they arrived (see oledb-windows's Program.cs
// for why naive concurrent dispatch is wrong); commands on different ids run concurrently. Every
// request/response carries a `requestId` for out-of-order correlation.
var connectedIds = new ConcurrentDictionary<string, bool>();
var lastOperationByConnection = new ConcurrentDictionary<string, Task>();
var stdoutLock = new object();
PIServer? server = null;

// Mirrors OIBusAgentWindows's PIController.ManageError: certain PI RPC error strings mean the
// connection to the PI server is broken beyond in-process recovery, so the whole helper process is
// killed and OIBus's own reconnect logic (which respawns this helper) takes over — the same recovery
// model the agent already used.
var restartOnErrors = new[]
{
    "[-10722] PINET: Timeout on PI RPC or System Call",
    "[-10723] PINET: No Connection",
    "[-10733] PINET: RPC Resolver is Off-line",
    "[-10734] PINET: Broken Connection"
};

string? line;
while ((line = Console.In.ReadLine()) != null)
{
    if (line.Length == 0)
    {
        continue;
    }
    ScheduleLine(line);
}

// stdin closed (EOF) — no more lines will ever be scheduled, but work already queued via Task.Run
// above may not have run yet (found by testing: a short-lived piped-input run could exit before its
// own background work executed, silently dropping responses). Drain everything currently chained
// per connection before actually exiting.
await Task.WhenAll(lastOperationByConnection.Values.ToArray());
return 0;

void ScheduleLine(string rawLine)
{
    JsonObject request;
    string? requestId;
    string id;
    try
    {
        request = JsonNode.Parse(rawLine)!.AsObject();
        requestId = request["requestId"]?.GetValue<string>();
        id = request["id"]?.GetValue<string>() ?? "";
    }
    catch (Exception ex)
    {
        WriteResponse(Failure(ex.ToString()), null);
        return;
    }

    lastOperationByConnection.AddOrUpdate(
        id,
        _ => Task.Run(() => ProcessRequest(request, requestId)),
        (_, previous) => previous.ContinueWith(_ => ProcessRequest(request, requestId), TaskScheduler.Default)
    );
}

void ProcessRequest(JsonObject request, string? requestId)
{
    JsonObject response;
    try
    {
        var command = request["command"]?.GetValue<string>();
        var id = request["id"]?.GetValue<string>() ?? "";
        response = command switch
        {
            "connect" => HandleConnect(id),
            "read" => HandleRead(id, request),
            "disconnect" => HandleDisconnect(id),
            _ => Failure($"Unknown command '{command}'")
        };
    }
    catch (Exception ex)
    {
        response = Failure(ex.ToString());
    }
    WriteResponse(response, requestId);
}

void WriteResponse(JsonObject response, string? requestId)
{
    if (requestId != null)
    {
        response["requestId"] = requestId;
    }
    lock (stdoutLock)
    {
        Console.Out.WriteLine(response.ToJsonString());
        Console.Out.Flush();
    }
}

JsonObject HandleConnect(string id)
{
    server ??= new PIServers().DefaultPIServer;
    if (!server.ConnectionInfo.IsConnected)
    {
        server.Connect();
    }
    connectedIds[id] = true;
    return new JsonObject
    {
        ["ok"] = true,
        ["serverInfo"] = new JsonObject
        {
            ["name"] = server.Name,
            ["version"] = server.ServerVersion,
            ["host"] = server.ConnectionInfo.Host,
            ["port"] = server.ConnectionInfo.Port
        }
    };
}

JsonObject HandleRead(string id, JsonObject request)
{
    if (server == null || !connectedIds.ContainsKey(id))
    {
        return Failure("Not connected");
    }

    var startTime = request["startTime"]!.GetValue<string>();
    var endTime = request["endTime"]!.GetValue<string>();
    var points = request["points"]!.AsArray().Select(p => p!.GetValue<string>()).ToList();

    var range = new AFTimeRange(startTime, endTime);
    var values = new JsonArray();

    // PIPoint.FindPIPoints(server, IEnumerable<string> names) resolves any mix of exact tag names and
    // wildcard name masks ('*', '?') in one bulk call — the AF SDK doesn't require splitting "known
    // tag name" (formerly a separate point-id path calling this same overload) from "wildcard search"
    // (formerly point-query, which called the single-string nameFilter overload) into two calls or two
    // overloads; both are just name masks to this one. No item `name`/`type` on the wire either — see
    // index.ts's `PiConnection.read` doc comment: the south connector already knows its own items and
    // maps raw PI point names back to them itself.
    //
    // Not verified against a live PI server in this environment (see README) — this merge relies on
    // documented AF SDK behavior for this overload (wildcard masks supported per entry), the same
    // residual live-connectivity gap already disclosed for the rest of this package.
    //
    // One call, one possible outcome — no `logs` array for partial failures: a single bulk resolution
    // either succeeds outright or fails outright, so a plain success/failure response (`values` or
    // `error`, matching every other command's shape) is enough. `south-pi.ts` is the one that logs the
    // error; this helper just reports it.
    try
    {
        ReadPoints(PIPoint.FindPIPoints(server, points), range, values);
    }
    catch (Exception exception)
    {
        ManageError(exception);
        return Failure(exception.Message);
    }

    return new JsonObject { ["values"] = values };
}

// Only formats and appends raw values — no max-instant tracking, no recordCount/timing, and no
// mapping of the raw PI point name back to the OIBus item name (the south connector does that,
// since only it knows the item list): the same division of responsibility @oibus/oledb-windows
// uses for rows.
//
// Deliberately reads only `.Timestamp.UtcTime` and `.Value` off each AFValue rather than passing the
// SDK object through as-is: tested directly, JsonSerializer.Serialize(afValue) throws
// FileNotFoundException for 'OSIsoft.PI.Net' — reading an AFValue's properties can trigger loading a
// PI client-network assembly independent of whether the value came from a real server call, so a
// whole-object passthrough is unreliable even on a working connection. AFTime alone serializes fine,
// but AFValue as a whole does not.
void ReadPoints(IEnumerable<PIPoint> points, AFTimeRange range, JsonArray values)
{
    var pointList = new PIPointList(points);
    var pagingConfiguration = new PIPagingConfiguration(PIPageType.EventCount, 20_000);
    var listResults = pointList.RecordedValues(range, AFBoundaryType.Inside, "", true, pagingConfiguration);

    foreach (var pointResults in listResults)
    {
        var pointName = pointResults.PIPoint?.Name ?? "";
        foreach (var value in pointResults)
        {
            values.Add(new JsonObject
            {
                ["pointId"] = pointName,
                ["timestamp"] = FormatInstant(value.Timestamp.UtcTime),
                // string.Format("{0}", null) yields "" (not a null-reference), matching the original agent's
                // OIBusAgentWindows/Web/PI/PIController.cs behavior exactly — never emit a JSON null here.
                ["value"] = string.Format(CultureInfo.InvariantCulture, "{0}", value.Value)
            });
        }
    }
}

JsonObject HandleDisconnect(string id)
{
    // Deliberately does not disconnect the shared PIServer — see the top-of-file comment.
    connectedIds.TryRemove(id, out _);
    return new JsonObject { ["ok"] = true };
}

void ManageError(Exception exception)
{
    if (!restartOnErrors.Any(pattern => exception.ToString().Contains(pattern)))
    {
        return;
    }
    // Mirrors the agent's own recovery: the connection is broken beyond in-process recovery, so this
    // process exits and OIBus's own reconnect logic (via the process 'exit' event) respawns it.
    Task.Run(async () =>
    {
        await Task.Delay(2000);
        Environment.Exit(1);
    });
}

static string FormatInstant(DateTime utc) => utc.ToString("yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'", CultureInfo.InvariantCulture);

// No `ok: false` — `error`'s presence alone is the failure signal (see index.ts's PiResponse doc
// comment: `!response.ok` still correctly detects this as falsy for connect/disconnect, which check
// it, while `read` checks `response.error` directly and never looks at `ok` at all).
static JsonObject Failure(string error) => new() { ["error"] = error };
