🛡️ SentinelGraph
The Ultimate AI Safety Layer

SentinelGraph is a high-performance firewall that sanitizes your LLM prompts. It intercepts and redacts sensitive information before it ever reaches the AI.

🌟 Key Highlights

Deep Packet Inspection (DPI) for Text: Every prompt goes through a detailed inspection.

Privacy First: API keys or Aadhaar details are never accidentally shared.

Scalable Architecture: Built on a .NET 8 asynchronous engine.

| Pattern Type      | Example Detected          | Status     |
| ----------------- | ------------------------- | ---------- |
| Auth Tokens       | JWT, GitHub PAT, AWS Keys | ❌ Blocked  |
| PII Data          | Aadhaar Card, PAN, Emails | ❌ Redacted |
| Sensitive Strings | Database Passwords        | ❌ Hidden   |

🛠️ Architecture Deep Dive

The system is divided into three layers:

The Guard (Extension)
Captures prompts using Chrome APIs.

The Messenger (Gateway)
Manages data flow to the engine via Apollo GraphQL.

The Brain (.NET Engine)
Cleans data using advanced regex and pattern-matching logic.

# Clone and setup
git clone https://github.com/curiousmind2811/SentinelGraph.git

# Start the Wash-Engine
cd engine && dotnet run

# Launch the Gateway
cd gateway && npm start

🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.
