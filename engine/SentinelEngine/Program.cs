// Program.cs (.NET Core 8.0)
using System.Text.RegularExpressions;
using System.Collections.Concurrent;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddCors();
builder.Services.ConfigureHttpJsonOptions(options => {
    options.SerializerOptions.PropertyNamingPolicy = null; // Ye casing ka jhanjhat khatam kar dega
});
var app = builder.Build();
app.UseCors(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";

// Port 5432 use karna (Direct Connection)
// Host name ke saath direct port 5432 aur SSL requirements
string dbConn = "Host=aws-1-ap-southeast-1.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.xjczolxvlhbmzsyatpvy;Password=SentinelSafe2026;SSL Mode=Require;Trust Server Certificate=true;Pooling=false";

// Brain Memory: Fast access ke liye patterns yahan rahenge
ConcurrentDictionary<string, Regex> CompiledPatterns = new();

// Evolution Logic: DB se patterns load karna
async Task RefreshBrain() {
    try {
        using var conn = new NpgsqlConnection(dbConn);
        var patterns = (await conn.QueryAsync<dynamic>("SELECT name, regex, \"isActive\" FROM \"SecurityPattern\"")).ToList();
        
        Console.WriteLine($"[DB] Total patterns found in DB: {patterns.Count}");

        var newPatterns = new ConcurrentDictionary<string, Regex>();
        int successCount = 0;
        int failCount = 0;

        foreach (var p in patterns) {
            // Debug: Check if isActive is actually true
            if (p.isActive != true) continue; 

            try {
                var compiled = new Regex(p.regex, RegexOptions.Compiled | RegexOptions.IgnoreCase);
                newPatterns.TryAdd((string)p.name, compiled);
                successCount++;
            } catch (Exception ex) {
                // YE SABSE IMPORTANT HAI: Dekhna ki error kya aa raha hai
                Console.WriteLine($"⚠️ Invalid Regex [{p.name}]: {ex.Message}");
                failCount++;
            }
        }

        CompiledPatterns = newPatterns; 
        Console.WriteLine($"[BRAIN] Final Memory: {successCount} active patterns loaded.");
    } catch (Exception ex) {
        Console.WriteLine($"❌ DB Error: {ex.Message}");
    }
}

// Initial learning
await RefreshBrain();

// API 1: Scan Engine
app.MapPost("/analyze", async (ScanRequest request) => {
    var original = request.text ?? "";
    if (string.IsNullOrWhiteSpace(original)) return Results.Ok(new { result = "SAFE" });

    // 1. Structure Detection
    var type = PromptStructureHelper.Detect(original);
    
    // 2. Intelligence: Targeted Scanning
    var scanTargets = PromptStructureHelper.ExtractScanTargets(original, type);
    var findings = new ConcurrentBag<string>();

    // 3. Parallel Sniper Scan
    // Hum har pattern ko sirf 'targets' par chalayenge, pure kachre par nahi
    Parallel.ForEach(CompiledPatterns, p => {
        foreach (var target in scanTargets) {
            // RegexOptions.Singleline humne RefreshBrain mein set kiya hai
            if (p.Value.IsMatch(target)) {
                findings.Add(p.Key);
                break; 
            }
        }
    });

    // 4. Redaction: Original text par replace maaro
    var threats = findings.Distinct().ToList();
    var cleanText = original;
    foreach (var name in threats) {
        cleanText = CompiledPatterns[name].Replace(cleanText, $"[BLOCK:{name}]");
    }

    Console.WriteLine($"[ENGINE] Type: {type} | Targets: {scanTargets.Count} | Threats: {threats.Count}");

    return Results.Ok(new { 
        result = threats.Count > 0 ? "DANGER" : "SAFE", 
        cleanText, 
        threatsFound = string.Join(", ", threats) 
    });
});

// API 2: Webhook to Update Brain (Jab Dashboard se naya pattern aaye)
app.MapPost("/refresh-brain", async () => {
    await RefreshBrain();
    return Results.Ok("Brain Updated Successfully");
});

app.Run($"http://0.0.0.0:{port}");


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
public record ScanRequest(string text);