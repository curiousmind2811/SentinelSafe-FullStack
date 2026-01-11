const { PrismaClient } = require("@prisma/client");
const axios = require("axios");
const prisma = new PrismaClient();

const getMetadata = (name, source) => {
  const n = name.toUpperCase();
  
  // 1. Specific Keys & Known Tokens (Rank 10)
  if (source === 'GITLEAKS' || n.includes("SLACK") || n.includes("STRIPE") || n.includes("XOX") || n.includes("SK_LIVE")) {
    return { cat: "SECRET", rank: 10, sev: "CRITICAL" };
  }

  // 2. Hunters & Keyword Washers (Rank 15)
  if (n.includes("HUNTER") || n.includes("WASHER") || n.includes("KV_") || n.includes("PASSWORD_VALUE")) {
    return { cat: "SECRET", rank: 15, sev: "CRITICAL" };
  }

  // 3. AI Safety & Injection (Rank 20)
  if (n.includes("INJECTION") || n.includes("JAILBREAK") || n.includes("DAN") || n.includes("SYSTEM")) {
    return { cat: "INJECTION", rank: 20, sev: "CRITICAL" };
  }

  // 4. Privacy/PII (Rank 50)
  if (n.includes("PII") || n.includes("AADHAR") || n.includes("CREDIT") || n.includes("CARD")) {
    return { cat: "PII", rank: 50, sev: "HIGH" };
  }

  return { cat: "GENERAL", rank: 100, sev: "MEDIUM" };
};

async function pumpAll() {
  let allPatterns = [];
  try {
    console.log("📥 Fetching Gitleaks...");
    const gitleaksRes = await axios.get("https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml");
    const gitleaksMatches = [...gitleaksRes.data.matchAll(/id = "(.*)"[\s\S]*?regex = '''(.*)'''/g)];
    
    gitleaksMatches.forEach(m => {
      const meta = getMetadata(m[1], 'GITLEAKS');
      allPatterns.push({ name: m[1].toUpperCase(), regex: m[2], ...meta });
    });

    console.log("📥 Adding Manual & AI Safety Patterns...");
   const manualPatterns = [
  // 1. Secrets & Tokens
  { name: "SLACK-TOKEN", regex: "(xox[p|b|o|a]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32})", source: "MANUAL" },
  { name: "STRIPE-LIVE-KEY", regex: "sk_live_[0-9a-zA-Z]{24}", source: "MANUAL" },

  // 2. The Hunters (The ones causing rank 100 right now)
  { name: "UNIVERSAL_TOKEN_HUNTER", regex: "(?i)\\b(api[\\s_-]?token|access[\\s_-]?token|auth[\\s_-]?token|secret|api[\\s_-]?key|token|key)\\b\\s*(?:is|=|:)\\s*['\\\"]?([^\\s'\\\"]{8,})", source: "HUNTER" },
  { name: "MALFORMED_PROMPT_HUNTER", regex: "(?i)(api[\\s_-]?token|token|pwd|password|secret|key)[^a-zA-Z0-9]{1,20}(?<value>[^'\"\\s,;{}]{8,})", source: "HUNTER" },
  { name: "UNIVERSAL_DATA_WASHER", regex: "(?i)(api[\\s_-]?token|token|key|pwd|password|secret|apiKey|secret_key|connectionstring)[^a-zA-Z0-9]{1,15}(?<value>[^'\"\\s,;{}]{8,})", source: "HUNTER" },
  { name: "MALFORMED_KV_HUNTER", regex: "(?i)(password|pwd|connectionstring|db_user|database)\\s*[:=]\\s*['\"\\s]*([^'\"\\s;{}]+)", source: "HUNTER" },
  { name: "PASSWORD_VALUE_AWARE", regex: "(?i)\\bpassw[o0]?[r]?[d]?\\b\\s*(?:is|=|:)\\s*['\"]?([^\\s'\"]{3,})['\"]?", source: "HUNTER" },

  // 3. AI Safety & Injection
  { name: "PROMPT-INJECTION-SYSTEM", regex: "(?i)(ignore previous instructions|system prompt|disregard)", source: "INJECTION" },
  { name: "JAILBREAK-DAN", regex: "(?i)(DAN|Do Anything Now|STAY HOT)", source: "INJECTION" },

  // 4. PII
  { name: "PII-AADHAR-INDIA", regex: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b", source: "PII" },
  { name: "PII-CREDIT-CARD", regex: "\\b(?:\\d[ -]*?){13,16}\\b", source: "PII" }
];

    manualPatterns.forEach(p => {
      const meta = getMetadata(p.name, p.source);
      allPatterns.push({ ...p, ...meta });
    });

    console.log(`⚡ Syncing ${allPatterns.length} patterns...`);

    for (const p of allPatterns) {
      await prisma.securityPattern.upsert({
        where: { name: p.name },
        update: { regex: p.regex, severity: p.sev, category: p.cat, rank: p.rank },
        create: { name: p.name, regex: p.regex, severity: p.sev, category: p.cat, rank: p.rank },
      });
    }

    console.log("✅ All Patterns Ranked and Synced!");

    const ENGINE_URL = process.env.NET_ENGINE_URL || "https://sentinel-engine.onrender.com";
    await axios.post(`${ENGINE_URL}/refresh-brain`);
    console.log("🧠 Engine Brain Refreshed!");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

pumpAll();