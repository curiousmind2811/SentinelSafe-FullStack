const { ApolloServer, gql } = require("apollo-server");
const axios = require("axios");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const ENGINE_BASE_URL = process.env.NET_ENGINE_URL || "http://127.0.0.1:5000";

const typeDefs = gql`
  type ScanResult {
    isSafe: Boolean
    redactedText: String
    engineResponse: String
  }

  # 1. Filter Input Type (Dynamic Query ke liye zaroori hai)
  input LogFilter {
    isSafe: Boolean
    riskLevel: String
    threats: String
  }

  type AuditLogRecord {
    id: Int
    userId: String
    originalText: String
    cleanText: String
    threats: String
    isSafe: Boolean
    riskLevel: String
    createdAt: String
  }

  input PatternFilter {
    severity: String
    isActive: Boolean
    name: String
  }

  type Pattern {
    id: Int
    name: String
    regex: String
    severity: String
    isActive: Boolean
  }

  type Query {
    # 2. Argument add kar diya filter lene ke liye
    getLogs(filter: LogFilter): [AuditLogRecord]
    getPatterns(filter: PatternFilter): [Pattern]
  }

  type Mutation {
    scanPrompt(text: String!): ScanResult

    addPattern(name: String!, regex: String!, severity: String!): Pattern

    saveAuditLog(
      userId: String!
      originalText: String!
      cleanText: String!
      threats: String
      riskLevel: String!
    ): AuditLogRecord
  }
`;

const resolvers = {
  Query: {
    getPatterns: async (_, { filter }) => {
      try {
        let where = {};
        
        if (filter) {
          if (filter.severity) where.severity = filter.severity;
          if (filter.isActive !== undefined) where.isActive = filter.isActive;
          
          // Search logic: Agar name diya hai toh partial match karega
          if (filter.name) {
            where.name = {
              contains: filter.name,
              mode: 'insensitive' // Taaki 'aws' aur 'AWS' dono chalein
            };
          }
        }

        const patterns = await prisma.securityPattern.findMany({
          where: where,
          orderBy: { name: 'asc' }
        });

        console.log(`Fetched Patterns: ${patterns.length}`);
        return patterns;
      } catch (e) {
        console.error("Database Error (Patterns):", e.message);
        return [];
      }
    },
    getLogs: async (_, { filter }) => {
      try {
        // Dynamic Filter: Agar filter pass kiya toh use 'where' mein daalo
        return await prisma.auditLog.findMany({
          where: filter || {}, 
          orderBy: { createdAt: 'desc' }
        });
      } catch (e) {
        console.error("Dynamic Query Error:", e.message);
        return [];
      }
    },
  },
  Mutation: {
    scanPrompt: async (_, { text }) => {
      try {
        // 1. .NET Analyze Engine ko call
       const response = await axios.post(`${ENGINE_BASE_URL}/analyze`, {
         text: text,
       });

        const { result, cleanText, threatsFound } = response.data;

        // 2. Database mein log save karna
        await prisma.auditLog.create({
          data: {
            originalText: text,
            cleanText: cleanText,
            threats: threatsFound,
            riskLevel: result,
            isSafe: result === "SAFE",
          },
        });

        return {
          isSafe: result === "SAFE",
          redactedText: cleanText,
          engineResponse: `Verified by .NET Engine | Status: ${result}`,
        };
      } catch (error) {
        console.error("Sync Error:", error.message);
        throw new Error("Backend bridge broken");
      }
    },
    addPattern: async (_, { name, regex, severity }) => {
      const newPattern = await prisma.securityPattern.create({
        data: { name, regex, severity },
      });

      try {
        // .NET Engine ko naye pattern ki notification bhejna
       await axios.post(`${ENGINE_BASE_URL}/refresh-brain`);
      } catch (e) {
        console.error("Brain refresh signal failed, but pattern saved locally.");
      }

      return newPattern;
    },
    saveAuditLog: async (_, args) => {
      return await prisma.auditLog.create({
        data: {
          userId: args.userId,
          originalText: args.originalText,
          cleanText: args.cleanText,
          threats: args.threats,
          riskLevel: args.riskLevel,
          isSafe: args.riskLevel === "SAFE"
        },
      });
    },
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  cors: {
    origin: "*", 
    methods: "GET,POST",
  },
});

const PORT = process.env.PORT || 4000;

server.listen({ port: PORT, host: '0.0.0.0' }).then(({ url }) => {
  console.log(`🚀 Sentinel Gateway ready at ${url}`);
});

