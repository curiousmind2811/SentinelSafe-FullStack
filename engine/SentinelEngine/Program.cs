// Program.cs (.NET Core 8.0)
using System.Text.RegularExpressions;
using System.Collections.Concurrent;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors();
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = null; // Ye casing ka jhanjhat khatam kar dega
});
var app = builder.Build();
app.UseCors(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());

// Port 5432 use karna (Direct Connection)
// Host name ke saath direct port 5432 aur SSL requirements
string dbConn = "Host=aws-1-ap-southeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.xjczolxvlhbmzsyatpvy;Password=SentinelSafe2026;SSL Mode=Require;Trust Server Certificate=true;Pooling=false";


List<SecurityPattern> SortedBrain = new();

// Evolution Logic: DB se patterns load karna
async Task RefreshBrain()
{
    try
    {
        using var conn = new NpgsqlConnection(dbConn);
        // "rank" aur "category" bhi select karo
        var patterns = (await conn.QueryAsync<dynamic>(
            "SELECT name, regex, rank, category, \"isActive\" FROM \"SecurityPattern\" ORDER BY rank ASC"
        )).ToList();

        var newBrain = new List<SecurityPattern>();

        foreach (var p in patterns)
        {
            if (p.isActive != true) continue;
            try
            {
                var compiled = new Regex((string)p.regex, RegexOptions.Compiled | RegexOptions.IgnoreCase);
                newBrain.Add(new SecurityPattern((string)p.name, compiled, (int)p.rank, (string)p.category));
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ Invalid Regex [{p.name}]: {ex.Message}");
            }
        }

        SortedBrain = newBrain; // Atomically swap brain
        Console.WriteLine($"[BRAIN] Loaded {SortedBrain.Count} patterns in Priority Order.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌ DB Error: {ex.Message}");
    }
}
// Initial learning
await RefreshBrain();

// API 1: Scan Engine
app.MapPost("/analyze", async (ScanRequest request) =>
{
    var original = request.text ?? "";
    if (string.IsNullOrWhiteSpace(original)) return Results.Ok(new { result = "SAFE" });

    var cleanText = original;
    var threats = new List<string>();

    // Priority Sequence Scanning
    foreach (var pattern in SortedBrain)
    {
        // Agar pattern match hota hai
        if (pattern.CompiledRegex.IsMatch(cleanText))
        {
            threats.Add(pattern.Name);

            // SMART REDACTION: Sirf matched value badlo
            // [BLOCK:CATEGORY] use karo taaki user ko context mile
            cleanText = pattern.CompiledRegex.Replace(cleanText, $"[BLOCK:{pattern.Category}]");

            // Note: Hum break nahi kar rahe taaki ek hi text mein 
            // AWS Key aur Injection dono detect ho sakein (Rank-wise)
        }
    }

    return Results.Ok(new
    {
        result = threats.Count > 0 ? "DANGER" : "SAFE",
        cleanText,
        threatsFound = string.Join(", ", threats.Distinct())
    });
});
// API 2: Webhook to Update Brain (Jab Dashboard se naya pattern aaye)
app.MapPost("/refresh-brain", async () =>
{
    await RefreshBrain();
    return Results.Ok("Brain Updated Successfully");
});


// --- YAHAN CHANGE HAI ---
var finalPort = Environment.GetEnvironmentVariable("PORT") ?? "5000";
Console.WriteLine($"[STARTING] Sentinel Engine on port {finalPort}...");
app.Run($"http://0.0.0.0:{finalPort}");


public enum PromptType { PlainText, StructuredData, CodeOrConfig }

public static class PromptStructureHelper
{
    // Professional detection: Ye sirf start/end nahi dekhta, complexity dekhta hai
    public static PromptType Detect(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return PromptType.PlainText;

        // Structured check (JSON/XML/Brackets)
        if (input.Contains("{") && input.Contains("}") && input.Contains(":"))
            return PromptType.StructuredData;

        // Config/Code check (Key-Value pairs or assignment)
        if (Regex.IsMatch(input, @"[a-zA-Z0-9_-]+\s*[:=]\s*", RegexOptions.Compiled))
            return PromptType.CodeOrConfig;

        return PromptType.PlainText;
    }

    // Ye hai "Solid" logic: Ye poora scan bhi karega aur "Windows" bhi nikaalega
    public static List<string> ExtractScanTargets(string input, PromptType type)
    {
        var targets = new List<string> { input }; // SECURITY RULE: Hamesha poora input scan karo

        if (type != PromptType.PlainText)
        {
            // Sirf wo lines uthao jisme potential khatra ho (Assignment lines)
            var riskLines = input.Split(new[] { '\n', '\r', ';' }, StringSplitOptions.RemoveEmptyEntries)
                                 .Where(line => line.Contains(":") || line.Contains("=") || line.Contains("\""))
                                 .Select(line => line.Trim());

            targets.AddRange(riskLines);
        }
        return targets.Distinct().ToList();
    }
}

public record SecurityPattern(string Name, Regex CompiledRegex, int Rank, string Category);
public record ScanRequest(string text);