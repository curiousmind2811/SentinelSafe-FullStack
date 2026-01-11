using System.Text.RegularExpressions;
using System.Text;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors();
builder.Services.ConfigureHttpJsonOptions(options => {
    options.SerializerOptions.PropertyNamingPolicy = null;
});

var app = builder.Build();
app.UseCors(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());

// 🛠️ CONFIGURATION: DB Connection Environment Variable se uthayein
string dbConn = Environment.GetEnvironmentVariable("DATABASE_URL") 
                ?? "Host=aws-1-ap-southeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.xjczolxvlhbmzsyatpvy;Password=SentinelSafe2026;SSL Mode=Require;Trust Server Certificate=true;Pooling=false";

// Global "Brain" store
List<SecurityPattern> SortedBrain = new();

// 🧠 REFRESH BRAIN: DB se patterns load karne ka logic
async Task RefreshBrain()
{
    try
    {
        using var conn = new NpgsqlConnection(dbConn);
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
            catch (Exception ex) { Console.WriteLine($"⚠️ Invalid Regex [{p.name}]: {ex.Message}"); }
        }

        Interlocked.Exchange(ref SortedBrain, newBrain); // Atomic swap for thread safety
        Console.WriteLine($"[BRAIN] Synchronized {SortedBrain.Count} patterns.");
    }
    catch (Exception ex) { Console.WriteLine($"❌ DB Error: {ex.Message}"); }
}

await RefreshBrain();

// 🛡️ API: ANALYZE ENGINE
app.MapPost("/analyze", async (ScanRequest request) =>
{
    var original = request.text ?? "";
    if (string.IsNullOrWhiteSpace(original)) return Results.Ok(new { result = "SAFE" });

    var threatsFound = new HashSet<string>();
    var allMatches = new List<TextMatch>();

    // 1. Scan saare patterns (Bina text ko modify kiye)
    foreach (var pattern in SortedBrain)
    {
        var matches = pattern.CompiledRegex.Matches(original);
        foreach (Match m in matches)
        {
            if (m.Success)
            {
                threatsFound.Add(pattern.Name);
                allMatches.Add(new TextMatch(m.Index, m.Length, pattern.Category));
            }
        }
    }

    // 2. SMART REDACTION: Overlaps ko handle karna
    // Matches ko peeche se (Reverse) process karna taaki string indices shift na hon
    var sortedMatches = allMatches
        .OrderByDescending(m => m.Index)
        .ThenByDescending(m => m.Length)
        .ToList();

    var cleanText = original;
    int lastRedactedIndex = original.Length + 1;

    foreach (var m in sortedMatches)
    {
        // Agar ye match pehle se redact ho chuke area ke andar hai, toh skip
        if (m.Index + m.Length <= lastRedactedIndex)
        {
            var prefix = cleanText.Substring(0, m.Index);
            var suffix = cleanText.Substring(m.Index + m.Length);
            cleanText = $"{prefix}[BLOCK:{m.Category}]{suffix}";
            
            lastRedactedIndex = m.Index; // Pointer update
        }
    }

    return Results.Ok(new
    {
        result = threatsFound.Count > 0 ? "DANGER" : "SAFE",
        cleanText,
        threatsFound = string.Join(", ", threatsFound)
    });
});

app.MapPost("/refresh-brain", async () => {
    await RefreshBrain();
    return Results.Ok("Brain Updated Successfully");
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Run($"http://0.0.0.0:{port}");

// --- Models & Helpers ---
public record SecurityPattern(string Name, Regex CompiledRegex, int Rank, string Category);
public record ScanRequest(string text);
public record TextMatch(int Index, int Length, string Category);