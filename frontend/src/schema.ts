import { z } from 'zod';

// Define sub-schemas first for clarity
const CiaSchema = z.object({
  confidentiality: z.string().describe("Confidentiality requirements/level"),
  integrity: z.string().describe("Integrity requirements/level"),
  availability: z.string().describe("Availability requirements/level"),
}).describe("CIA Triad Assessment");

const DataPointSchema = z.object({
  name: z.string().describe("Name or description of the data point"),
  cia: CiaSchema,
}).describe("Identified data point and its CIA assessment");

const ThreatVulnerabilitySchema = z.object({
  description: z.string().describe("Description of the threat or vulnerability"),
  relatedDataPoints: z.array(z.string()).optional().describe("Names of related data points (optional)"),
}).describe("Identified threat or vulnerability");

const MitigationSchema = z.object({
  description: z.string().describe("Description of the mitigation strategy"),
  relatedThreats: z.array(z.string()).optional().describe("Names of related threats/vulnerabilities (optional)"),
}).describe("Mitigation strategy");

// Define the main compliance schema
// Note: repositoryUrl is handled separately in the UI state, not part of the stored JSON blob itself.
export const ComplianceContentSchema = z.object({
  lawsAndRegulations: z.array(z.string()).describe("List of relevant laws and regulations"),
  dataPoints: z.array(DataPointSchema).describe("List of identified data points"),
  threatsAndVulnerabilities: z.array(ThreatVulnerabilitySchema).describe("List of identified threats and vulnerabilities"),
  mitigations: z.array(MitigationSchema).describe("List of proposed mitigations"),
}).describe("Compliance assessment structure for a repository");

// Define a type for convenience
export type ComplianceData = z.infer<typeof ComplianceContentSchema>;

// Define an initial empty state that conforms to the schema structure
export const initialComplianceData: ComplianceData = {
    lawsAndRegulations: [],
    dataPoints: [],
    threatsAndVulnerabilities: [],
    mitigations: [],
};

// Schema for the chat message structure
export const ChatMessageSchema = z.object({
    sender: z.enum(['user', 'agent']),
    text: z.string(),
    timestamp: z.date(), // Add timestamp for ordering
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Schema for the state sent to the backend
export const BackendPayloadSchema = z.object({
    repositoryUrl: z.string().url(),
    complianceData: ComplianceContentSchema,
    messages: z.array(ChatMessageSchema),
});

export type BackendPayload = z.infer<typeof BackendPayloadSchema>;

// Schema for the response from the backend
export const BackendResponseSchema = z.object({
    newMessage: ChatMessageSchema,
    updatedComplianceData: ComplianceContentSchema.optional(), // Compliance data might not always be updated
});

export type BackendResponse = z.infer<typeof BackendResponseSchema>;
