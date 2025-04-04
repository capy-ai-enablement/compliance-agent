import { z } from "zod";

// Define sub-schemas first for clarity
export const CiaSchema = z
  .object({
    confidentiality: z
      .number()
      .min(1)
      .max(4)
      .describe("Confidentiality rating (1-4)"),
    integrity: z.number().min(1).max(4).describe("Integrity rating (1-4)"),
    availability: z
      .number()
      .min(1)
      .max(4)
      .describe("Availability rating (1-4)"),
  })
  .describe("CIA Triad Assessment (Ratings 1-4)");

export const DataPointSchema = z
  .object({
    name: z.string().describe("Name or description of the data point"),
    cia: CiaSchema,
  })
  .describe("Identified data point and its CIA assessment");

// Forward declaration for MitigationSchema used in ThreatVulnerabilitySchema
let MitigationSchema: z.ZodTypeAny;

export const ThreatVulnerabilitySchema = z
  .object({
    description: z
      .string()
      .describe("Description of the threat or vulnerability"),
    mitigations: z
      .array(z.lazy(() => MitigationSchema)) // Use z.lazy for recursive reference
      .describe("List of proposed mitigations for this threat"),
  })
  .describe("Identified threat or vulnerability and its mitigations");

MitigationSchema = z // Assign the actual schema definition
  .object({
    description: z.string().describe("Description of the mitigation strategy"),
  })
  .describe("Mitigation strategy");


// New General section schema
export const GeneralSchema = z
  .object({
    description: z
      .string()
      .describe("Brief description of the project/repository context"),
  })
  .describe("General project information");

// Define the main compliance schema with the new structure
export const ComplianceContentSchema = z
  .object({
    general: GeneralSchema.describe("General project information"),
    lawsAndRegulations: z
      .array(z.string())
      .describe("List of relevant laws and regulations"),
    dataPoints: z
      .array(DataPointSchema)
      .describe("List of identified data points"),
    threatsAndVulnerabilities: z
      .array(ThreatVulnerabilitySchema)
      .describe(
        "List of identified threats, vulnerabilities, and their mitigations"
      ),
  })
  .describe("Compliance assessment structure for a repository");

// Define a type for convenience (can be inferred via tRPC, but useful internally)
export type ComplianceData = z.infer<typeof ComplianceContentSchema>;

// Define an initial empty state that conforms to the new schema structure
export const initialComplianceData: ComplianceData = {
  general: { description: "" }, // Initialize general section
  lawsAndRegulations: [],
  dataPoints: [],
  threatsAndVulnerabilities: [],
};

// Schema for the chat message structure (using ISO string for timestamp for easier storage)
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "agent"]),
  text: z.string(),
  // Store timestamp as ISO 8601 string for reliable JSON serialization/deserialization
  timestamp: z
    .string()
    .datetime({ message: "Invalid ISO 8601 timestamp string" }),
});

// Type helper for the stored format (can be inferred via tRPC)
export type StoredChatMessage = z.infer<typeof ChatMessageSchema>;

// Schema for the request sent to the agent endpoint
export const AgentRequestSchema = z.object({
  repositoryUrl: z.string().url(),
  complianceData: ComplianceContentSchema,
  messages: z.array(ChatMessageSchema), // Array of messages with string timestamps
});

export type AgentRequest = z.infer<typeof AgentRequestSchema>;

// Schema for the response received from the agent endpoint
export const AgentResponseSchema = z.object({
  newMessage: ChatMessageSchema, // Message with string timestamp
  updatedComplianceData: ComplianceContentSchema.optional(), // Compliance data might not always be updated
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;
