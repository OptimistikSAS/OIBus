using System.Collections.Concurrent;
using System.Data;
using System.Data.OleDb;
using System.Globalization;
using System.Text.Json.Nodes;

// A single process shared by every OIBus south-oledb connector in the running OIBus instance (see
// @oibus/oledb-windows's OleDbBridge/OleDbConnection). Each logical connection is tracked by an `id`
// the JS side generates; any number of connections can be open at once, against the same or
// different OLE DB targets, and commands on different connections run fully concurrently.
//
// Commands on the SAME connection id must still run in the order they arrived (connect, then reads,
// then disconnect) — `lastOperationByConnection` enforces that by chaining each new command for a
// given id onto that id's previous command via ContinueWith, built up synchronously in the main read
// loop (so the chain reflects true arrival order) before the actual work is dispatched to the thread
// pool. A naive `Task.Run` per line without this chaining was tried first and is wrong: two commands
// for the same id can then race and run out of order (observed directly: a `read` reaching
// "Not connected" because its own `connect` for the same id hadn't finished yet).
//
// Every request carries a `requestId`; every response echoes it back unchanged so the JS side can
// match a response to its caller regardless of arrival order — necessary because different
// connections' commands run concurrently, so a fast query on connection B can finish (and get
// written to stdout) before a slow query on connection A that was sent first.
var connections = new ConcurrentDictionary<string, OleDbConnection>();
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

JsonObject HandleConnect(string id, JsonObject request)
{
    var connectionString = request["connectionString"]!.GetValue<string>();
    var connection = new OleDbConnection(connectionString);
    connection.Open();
    connections[id] = connection;
    return new JsonObject { ["ok"] = true };
}

JsonObject HandleRead(string id, JsonObject request)
{
    if (!connections.TryGetValue(id, out var connection) || connection.State != ConnectionState.Open)
    {
        return Failure("Not connected");
    }

    var sql = request["sql"]!.GetValue<string>();
    var readTimeout = request["readTimeout"]?.GetValue<int>();

    using var executionCommand = new OleDbCommand(sql, connection) { CommandTimeout = readTimeout ?? 30_000 };
    using var reader = executionCommand.ExecuteReader();

    var rows = new JsonArray();
    while (reader.Read())
    {
        var row = new JsonObject();
        for (int ordinal = 0; ordinal < reader.FieldCount; ordinal++)
        {
            row[reader.GetName(ordinal)] = reader.IsDBNull(ordinal) ? null : ToJsonValue(reader.GetValue(ordinal));
        }
        rows.Add(row);
    }
    reader.Close();

    return new JsonObject { ["ok"] = true, ["rows"] = rows };
}

JsonObject HandleDisconnect(string id)
{
    if (connections.TryRemove(id, out var connection))
    {
        connection.Close();
        connection.Dispose();
    }
    return new JsonObject { ["ok"] = true };
}

static JsonValue? ToJsonValue(object value) => value switch
{
    bool b => JsonValue.Create(b),
    byte or short or int or long => JsonValue.Create(Convert.ToInt64(value, CultureInfo.InvariantCulture)),
    float or double or decimal => JsonValue.Create(Convert.ToDouble(value, CultureInfo.InvariantCulture)),
    DateTime dateTime => JsonValue.Create(dateTime.ToString("o", CultureInfo.InvariantCulture)),
    _ => JsonValue.Create(value.ToString())
};

static JsonObject Failure(string error) => new() { ["ok"] = false, ["error"] = error };
