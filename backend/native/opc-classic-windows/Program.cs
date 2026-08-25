using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json.Nodes;
using Opc;
using DAServer = Opc.Da.Server;
using HDAServer = Opc.Hda.Server;

// A single process shared by every OIBus south-opc connector in the running OIBus instance (see
// @oibus/opc-classic-windows's OpcBridge/OpcConnection). Unlike PI (one shared global PIServer),
// each logical connection here gets its own real Opc.Server — matching OIBusAgentWindows's own
// OPCService.cs Dictionary<string, Server> exactly, since different OPC connectors can genuinely
// target different servers/hosts/modes.
//
// Commands on the same connection id run in the order they arrived (see oledb-windows's Program.cs
// for why naive concurrent dispatch is wrong); commands on different ids run concurrently. Every
// request/response carries a `requestId` for out-of-order correlation.
var servers = new ConcurrentDictionary<string, Opc.Server>();
var lastOperationByConnection = new ConcurrentDictionary<string, Task>();
var stdoutLock = new object();

string? line;
while ((line = Console.In.ReadLine()) != null)
{
    if (line.Length == 0)
    {
        continue;
    }
    ScheduleLine(line);
}

// Drain everything currently chained per connection before actually exiting — a short-lived piped
// run could otherwise hit stdin EOF and return before its own dispatched work executed (found by
// testing on @oibus/pi-afsdk-windows; the same fix is applied here from the start).
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
            "connect" => HandleConnect(id, request),
            "read" => HandleRead(id, request),
            "browse" => HandleBrowse(id, request),
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

// Mirrors OIBusAgentWindows's OPCService.Connect exactly: idempotent (skips Connect() if already
// connected), lazily creates the server object on first call per id, and on any connect failure
// disposes the server and evicts it from the dictionary so the next attempt starts from a fresh
// DCOM activation instead of retrying a dead COM object.
JsonObject HandleConnect(string id, JsonObject request)
{
    var host = request["host"]!.GetValue<string>();
    var serverName = request["serverName"]!.GetValue<string>();
    var mode = request["mode"]!.GetValue<string>();

    var isNew = !servers.TryGetValue(id, out var server);
    if (isNew)
    {
        server = mode == "da"
            ? new DAServer(new OpcCom.Factory(), new URL($"opcda://{host}/{serverName}"))
            : new HDAServer(new OpcCom.Factory(), new URL($"opchda://{host}/{serverName}"));
    }

    try
    {
        if (!server!.IsConnected)
        {
            server.Connect();
        }
        if (isNew)
        {
            servers[id] = server;
        }
    }
    catch (Exception)
    {
        server!.Dispose();
        if (!isNew)
        {
            servers.TryRemove(id, out _);
        }
        throw;
    }

    return new JsonObject { ["ok"] = true, ["serverInfo"] = GetServerInfo(server!) };
}

// {vendorInfo, productVersion, serverState} off the server's own GetStatus() — same fields
// OIBusAgentWindows's GetStatus endpoint exposed (minus the HDA-only aggregate list, which the
// south connector doesn't need). Opc.Da.ServerStatus and Opc.Hda.ServerStatus are two unrelated
// types (not a shared base), but expose the same field names by convention — same reason the
// original agent's own GetStatus() branches on DA vs HDA instead of using one shared type.
JsonObject GetServerInfo(Opc.Server server)
{
    if (server is HDAServer hdaServer)
    {
        var status = hdaServer.GetStatus();
        return new JsonObject { ["vendorInfo"] = status.VendorInfo, ["productVersion"] = status.ProductVersion, ["serverState"] = status.ServerState.ToString() };
    }
    else
    {
        var status = ((DAServer)server).GetStatus();
        return new JsonObject { ["vendorInfo"] = status.VendorInfo, ["productVersion"] = status.ProductVersion, ["serverState"] = status.ServerState.ToString() };
    }
}

JsonObject HandleRead(string id, JsonObject request)
{
    if (!servers.TryGetValue(id, out var server))
    {
        return Failure("Not connected");
    }

    var startTime = request["startTime"]!.GetValue<string>();
    var endTime = request["endTime"]!.GetValue<string>();
    var nodeIds = request["items"]!.AsArray().Select(n => n!.GetValue<string>()).ToArray();
    var values = new JsonArray();

    if (server is DAServer daServer)
    {
        ReadDaValues(daServer, nodeIds, values);
    }
    else
    {
        var aggregate = request["aggregate"]?.GetValue<string>() ?? "raw";
        var resampling = request["resampling"]?.GetValue<string>() ?? "none";
        var maxReadValues = request["maxReadValues"]?.GetValue<int>() ?? 3600;
        var intervalReadDelay = request["intervalReadDelay"]?.GetValue<int>() ?? 200;
        ReadHdaValues((HDAServer)server, startTime, endTime, aggregate, resampling, maxReadValues, intervalReadDelay, nodeIds, values);
    }

    return new JsonObject { ["values"] = values };
}

// Ported from OIBusAgentWindows's ReadDAValues: one synchronous bulk Read() call, no paging (DA
// only ever returns current/live values, never a backlog). No item name mapping here — the raw
// `nodeId` goes straight into each value, same as ReadHdaValues below; the south connector maps it
// back to its own item using `nodeId`, the same division of responsibility @oibus/pi-afsdk-windows
// uses for raw PI point names.
void ReadDaValues(DAServer server, string[] nodeIds, JsonArray values)
{
    var itemsToRead = nodeIds.Select(nodeId => new Opc.Da.Item(new ItemIdentifier(nodeId))).ToArray();
    var results = server.Read(itemsToRead);
    foreach (Opc.Da.ItemValueResult itemValue in results)
    {
        if (itemValue.Value == null)
        {
            continue;
        }
        values.Add(new JsonObject
        {
            ["nodeId"] = itemValue.ItemName,
            ["timestamp"] = FormatInstant(itemValue.Timestamp),
            ["value"] = string.Format(CultureInfo.InvariantCulture, "{0}", itemValue.Value),
            ["quality"] = $"0x{(int)itemValue.Quality.QualityBits:X}"
        });
    }
}

// Ported from OIBusAgentWindows's ReadHDAValues, including its manual pagination: HDA queries over
// a wide time range can return more values than fit in one response (`ResultID.Hda.S_MOREDATA`), so
// this loops — resuming from the minimum "max time seen so far" across items that still have more
// data, releasing items that are fully drained, and sleeping `intervalReadDelay` ms between pages
// (a deliberate pacing choice from the original agent, not a bug) — until nothing has more data.
void ReadHdaValues(
    HDAServer server,
    string startTime,
    string endTime,
    string aggregate,
    string resampling,
    int maxReadValues,
    int intervalReadDelay,
    string[] nodeIds,
    JsonArray values
)
{
    var intervalStartTime = DateTime.Parse(startTime);
    var intervalEndTime = DateTime.Parse(endTime);
    var itemsCreated = server.CreateItems(nodeIds.Select(nodeId => new ItemIdentifier(nodeId)).ToArray());
    var aggregateId = GetAggregateId(aggregate);
    var isRaw = aggregate == "raw";
    var itemsToRead = itemsCreated
        .Select(item => isRaw ? new Opc.Hda.Item(item) : new Opc.Hda.Item(item) { AggregateID = aggregateId })
        .ToList();

    bool hasMoreData;
    do
    {
        var nextStartTime = DateTime.Parse(endTime); // tracks the minimum "still has more" time across items
        var readResults = isRaw
            ? server.ReadRaw(new Opc.Hda.Time(intervalStartTime), new Opc.Hda.Time(intervalEndTime), maxReadValues, false, itemsToRead.ToArray())
            : server.ReadProcessed(new Opc.Hda.Time(intervalStartTime), new Opc.Hda.Time(intervalEndTime), GetResampleInterval(resampling), itemsToRead.ToArray());

        hasMoreData = false;
        var itemsToRelease = new List<Opc.Hda.Item>();
        foreach (var resultCollection in readResults)
        {
            var currentItemMaxTime = intervalStartTime;
            foreach (Opc.Hda.ItemValue itemValue in resultCollection)
            {
                if (itemValue.Timestamp > currentItemMaxTime)
                {
                    currentItemMaxTime = itemValue.Timestamp; // advance even for a null value, to keep the loop moving
                }
                if (itemValue.Value == null)
                {
                    continue;
                }
                values.Add(new JsonObject
                {
                    ["nodeId"] = resultCollection.ItemName,
                    ["timestamp"] = FormatInstant(itemValue.Timestamp),
                    ["value"] = string.Format(CultureInfo.InvariantCulture, "{0}", itemValue.Value),
                    ["quality"] = $"0x{(int)itemValue.Quality.QualityBits + (int)itemValue.HistorianQuality:X}"
                });
            }

            if (resultCollection.ResultID == Opc.ResultID.Hda.S_MOREDATA)
            {
                hasMoreData = true;
                if (nextStartTime > currentItemMaxTime)
                {
                    nextStartTime = currentItemMaxTime;
                }
            }
            else
            {
                var drained = itemsToRead.Find(item => item.ItemName == resultCollection.ItemName);
                if (drained != null)
                {
                    itemsToRelease.Add(drained);
                }
                itemsToRead.RemoveAll(item => item.ItemName == resultCollection.ItemName);
            }
        }

        if (itemsToRelease.Count > 0)
        {
            server.ReleaseItems(itemsToRelease.ToArray());
        }

        if (hasMoreData)
        {
            intervalStartTime = nextStartTime;
            Thread.Sleep(intervalReadDelay);
        }
    } while (hasMoreData);
}

JsonObject HandleBrowse(string id, JsonObject request)
{
    if (!servers.TryGetValue(id, out var server))
    {
        return Failure("Not connected");
    }

    var nodeId = request["nodeId"]?.GetValue<string>() ?? "";
    var recursive = request["recursive"]?.GetValue<bool>() ?? false;

    var nodes = server is DAServer daServer
        ? BrowseDaNodes(daServer, nodeId, recursive)
        : BrowseHdaNodes((HDAServer)server, nodeId, recursive);

    return new JsonObject { ["nodes"] = nodes };
}

JsonArray BrowseDaNodes(DAServer server, string nodeId, bool recursive)
{
    var browseElements = server.Browse(new ItemIdentifier(nodeId), new Opc.Da.BrowseFilters(), out _);
    return ToNodeArray(browseElements, e => e.Name, e => e.ItemName, e => e.IsItem, e => e.HasChildren, child => BrowseDaNodes(server, child, recursive), recursive);
}

JsonArray BrowseHdaNodes(HDAServer server, string nodeId, bool recursive)
{
    var browser = server.CreateBrowser(Array.Empty<Opc.Hda.BrowseFilter>(), out _);
    try
    {
        var browseElements = browser.Browse(new ItemIdentifier(nodeId));
        return ToNodeArray(
            browseElements,
            e => e.Name,
            e => e.ItemName,
            e => e.IsItem,
            e => e.HasChildren,
            child => BrowseHdaNodes(server, child, recursive),
            recursive
        );
    }
    finally
    {
        browser.Dispose();
    }
}

// Shared tree-building shape for DA's Opc.Da.BrowseElement[] and HDA's Opc.Hda.BrowseElement[] —
// same fields on both (Name/ItemName/IsItem/HasChildren), just two unrelated types, so this takes
// field accessors instead of a common interface.
JsonArray ToNodeArray<T>(
    T[]? browseElements,
    Func<T, string> getName,
    Func<T, string> getItemName,
    Func<T, bool> getIsItem,
    Func<T, bool> getHasChildren,
    Func<string, JsonArray> browseChildren,
    bool recursive
)
{
    var nodes = new JsonArray();
    if (browseElements == null)
    {
        return nodes;
    }
    foreach (var element in browseElements)
    {
        var hasChildren = getHasChildren(element);
        var itemName = getItemName(element);
        nodes.Add(new JsonObject
        {
            ["name"] = getName(element),
            ["nodeId"] = itemName,
            ["isItem"] = getIsItem(element),
            ["hasChildren"] = hasChildren,
            ["nodes"] = hasChildren && recursive ? browseChildren(itemName) : new JsonArray()
        });
    }
    return nodes;
}

JsonObject HandleDisconnect(string id)
{
    if (!servers.TryRemove(id, out var server))
    {
        return new JsonObject { ["ok"] = true }; // already disconnected — not an error, matches PI/OLEDB's tolerance
    }
    server.Disconnect();
    server.Dispose();
    return new JsonObject { ["ok"] = true };
}

// Same 25-value mapping as OIBusAgentWindows's getAggregateId — any unrecognized aggregate name
// (including a genuinely invalid one) defaults to 0 (raw), matching the original's own behavior.
int GetAggregateId(string aggregate) => aggregate switch
{
    "raw" => 0,
    "interpolative" => 1,
    "total" => 2,
    "average" => 3,
    "time-average" => 4,
    "count" => 5,
    "stdev" => 6,
    "minimum-actual-time" => 7,
    "minimum" => 8,
    "maximum-actual-time" => 9,
    "maximum" => 10,
    "start" => 11,
    "end" => 12,
    "delta" => 13,
    "reg-slope" => 14,
    "reg-const" => 15,
    "reg-dev" => 16,
    "variance" => 17,
    "range" => 18,
    "duration-good" => 19,
    "duration-bad" => 20,
    "percent-good" => 21,
    "percent-bad" => 22,
    "worst-quality" => 23,
    "annotations" => 24,
    _ => 0
};

// Same mapping as OIBusAgentWindows's getResampleInterval. Deliberately defaults to 0 ("none") for
// any unrecognized value — this is what already made the manifest's own historical `'raw'`-as-a-
// resampling-default bug harmless: 'raw' was never a valid case here either, so it always fell
// through to "no resampling" anyway. No migration needed for existing items with that stored value.
decimal GetResampleInterval(string resampling) => resampling switch
{
    "none" => 0,
    "1s" => 1,
    "10s" => 10,
    "30s" => 30,
    "1min" => 60,
    "1h" => 3600,
    "1d" => 3600 * 24,
    _ => 0
};

static string FormatInstant(DateTime timestamp) => timestamp.ToUniversalTime().ToString("yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fff'Z'", CultureInfo.InvariantCulture);

static JsonObject Failure(string error) => new() { ["error"] = error };
