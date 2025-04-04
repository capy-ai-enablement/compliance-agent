import { z } from 'zod';

// Define sub-schemas first for clarity
const CiaSchema = z.object({
  confidentiality: z.number().min(1).max(4).describe("Confidentiality rating (1-4)"),
  integrity: z.number().min(1).max(4).describe("Integrity rating (1-4)"),
  availability: z.number().min(1).max(4).describe("Availability rating (1-4)"),
}).describe("CIA Triad Assessment (Ratings 1-4)");

const DataPointSchema = z.object({
  name: z.string().describe("Name or description of the data point"),
  cia: CiaSchema,
}).describe("Identified data point and its CIA assessment");

const ThreatVulnerabilitySchema = z.object({
  description: z.string().describe("Description of the threat or vulnerability"),
  // relatedDataPoints removed as requested
  mitigations: z.array(z.lazy(() => MitigationSchema)).describe("List of proposed mitigations for this threat"), // Nest mitigations
}).describe("Identified threat or vulnerability and its mitigations");

const MitigationSchema = z.object({
  description: z.string().describe("Description of the mitigation strategy"),
  // relatedThreats removed as requested
}).describe("Mitigation strategy");

// New General section schema
const GeneralSchema = z.object({
    description: z.string().describe("Brief description of the project/repository context"),
}).describe("General project information");


// Define the main compliance schema with the new structure
// Note: repositoryUrl is handled separately in the UI state, not part of the stored JSON blob itself.
export const ComplianceContentSchema = z.object({
  general: GeneralSchema.describe("General project information"),
  lawsAndRegulations: z.array(z.string()).describe("List of relevant laws and regulations"),
  dataPoints: z.array(DataPointSchema).describe("List of identified data points"),
  threatsAndVulnerabilities: z.array(ThreatVulnerabilitySchema).describe("List of identified threats, vulnerabilities, and their mitigations"),
  // Top-level mitigations removed, now nested under threats
}).describe("Compliance assessment structure for a repository");

// Define a type for convenience
export type ComplianceData = z.infer<typeof ComplianceContentSchema>;

// Define an initial empty state that conforms to the new schema structure
export const initialComplianceData: ComplianceData = {
    general: { description: "" }, // Initialize general section
    lawsAndRegulations: [],
    dataPoints: [],
    threatsAndVulnerabilities: [],
    // mitigations removed from initial state
};

// Schema for the chat message structure (using ISO string for timestamp for easier storage)
export const ChatMessageSchema = z.object({
    sender: z.enum(['user', 'agent']),
    text: z.string(),
    // Store timestamp as ISO 8601 string for reliable JSON serialization/deserialization
    timestamp: z.string().datetime({ message: "Invalid ISO 8601 timestamp string" }),
});

// Type for runtime use (convert timestamp back to Date object after loading)
export type ChatMessage = {
    sender: 'user' | 'agent';
    text: string;
    timestamp: Date; // Use Date object in runtime state
};

// Type helper for the stored format
export type StoredChatMessage = z.infer<typeof ChatMessageSchema>;

// Schema for the state sent to the backend (uses the stored format with string timestamps)
export const BackendPayloadSchema = z.object({
    repositoryUrl: z.string().url(),
    complianceData: ComplianceContentSchema,
    messages: z.array(ChatMessageSchema), // Array of messages with string timestamps
});

export type BackendPayload = z.infer<typeof BackendPayloadSchema>;

// Schema for the response from the backend (uses the stored format with string timestamps)
export const BackendResponseSchema = z.object({
    newMessage: ChatMessageSchema, // Message with string timestamp
    updatedComplianceData: ComplianceContentSchema.optional(), // Compliance data might not always be updated
});

export type BackendResponse = z.infer<typeof BackendResponseSchema>;
