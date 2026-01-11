const { PrismaClient } = require("@prisma/client");
const axios = require("axios");

const prisma = new PrismaClient();

async function pumpAll() {
  let allPatterns = [];

  try {
    console.log("📥 Source 1: Fetching Gitleaks (Secrets)...");
    const gitleaksRes = await axios.get(
      "https://raw.githubusercontent.com/gitleaks/gitleaks/master/config/gitleaks.toml"
    );
    const gitleaksMatches = [
      ...gitleaksRes.data.matchAll(/id = "(.*)"[\s\S]*?regex = '''(.*)'''/g),
    ];
    gitleaksMatches.forEach((m) =>
      allPatterns.push({
        name: m[1].toUpperCase(),
        regex: m[2],
        severity: "CRITICAL",
      })
    );

    console.log("📥 Source 2: Fetching TruffleHog (SaaS Keys)...");
    // Simplified TruffleHog style common patterns
    allPatterns.push(
      {
        name: "SLACK-TOKEN",
        regex: "(xox[p|b|o|a]-[0-9]{12}-[0-9]{12}-[0-9]{12}-[a-z0-9]{32})",
        severity: "CRITICAL",
      },
      {
        name: "STRIPE-LIVE-KEY",
        regex: "sk_live_[0-9a-zA-Z]{24}",
        severity: "CRITICAL",
      }
    );

    console.log("📥 Source 3: Adding Jailbreak & PII Patterns (AI Safety)...");
    // Microsoft Presidio + OWASP Jailbreak logic
    const aiSafety = [
      {
        name: "PROMPT-INJECTION-SYSTEM",
        regex:
          "(?i)(ignore previous instructions|system prompt|you are now a|disregard)",
        severity: "HIGH",
      },
      {
        name: "PII-CREDIT-CARD",
        regex: "\\b(?:\\d[ -]*?){13,16}\\b",
        severity: "HIGH",
      },
      {
        name: "PII-AADHAR-INDIA",
        regex: "\\b\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}\\b",
        severity: "MEDIUM",
      },
      {
        name: "JAILBREAK-DAN",
        regex: "(?i)(DAN|Do Anything Now|STAY HOT)",
        severity: "CRITICAL",
      },
    ];
    allPatterns = [...allPatterns, ...aiSafety];

    console.log(`📦 Total Unique Patterns Prepared: ${allPatterns.length}`);

    console.log("⚡ Syncing to Supabase (Upsert Mode)...");
    let count = 0;
    for (const p of allPatterns) {
      // Hum 'name' use kar rahe hain unique check ke liye
      // Make sure your schema has @unique on name
      await prisma.securityPattern.upsert({
        where: { name: p.name },
        update: { regex: p.regex, severity: p.severity },
        create: {
          name: p.name,
          regex: p.regex,
          severity: p.severity,
          isActive: true,
        },
      });
      count++;
      if (count % 50 === 0) console.log(`⏳ Progress: ${count} synced...`);
    }

    console.log(`✅ Success! ${count} patterns are now Live.`);

    // Brain Refresh

    const ENGINE_URL =
    process.env.NET_ENGINE_URL || "https://sentinel-engine.onrender.com";
    await axios.post(`${ENGINE_URL}/refresh-brain`);
    console.log("🧠 .NET Brain synchronized!");
  } catch (error) {
    console.error("❌ Unified Pump Failed:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

pumpAll();
