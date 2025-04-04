import { TRPCError } from "@trpc/server";
import { z } from "zod"; // Import zod
// Import the centralized schemas/types with updated names
import {
  AgentRequest, // Renamed from BackendPayload
  AgentResponse, // Renamed from BackendResponse
  ChatMessageSchema, // Needed for constructing the response message
  ComplianceContentSchema, // Potentially needed if updating compliance data
  StoredChatMessage, // Import this type for explicit typing
} from "./schemas";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import {
  convertMcpToLangchainTools,
  McpServerCleanupFn,
} from "./langchainMcpTools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMcpServers } from "./mcpServers";
import { getLlm } from "./llm";
import { ChatOpenAI, AzureChatOpenAI } from "@langchain/openai";

// Old interfaces are removed, using imported types now

export const generateAgentResponse = async (
  input: AgentRequest // Use the renamed AgentRequest type
): Promise<AgentResponse> => { // Return type is now AgentResponse
  const llm = getLlm();

  // Prepend the system message
  const systemMessage = new SystemMessage(
    "You are a general helper agent that can use MCP servers to help the user. When you have used a tool, you always provide a direct answer to the user query based on the information gathered by your tool usage."
  );

  // Convert frontend messages (StoredChatMessage format) to Langchain format
  const conversationHistory: (HumanMessage | AIMessage)[] = input.messages.map(
    (msg: StoredChatMessage) => { // Add explicit type for msg
      // msg now has { role: 'user' | 'agent', text: string, timestamp: string }
      if (msg.role === "user") {
        return new HumanMessage(msg.text); // Use msg.text
      } else {
        // agent
        return new AIMessage(msg.text); // Use msg.text
      }
    }
  );

  const langchainMessages: BaseMessage[] = [systemMessage, ...conversationHistory];
  let mcpCleanup: McpServerCleanupFn | undefined;
  let responseContent: string;

  try {
    const mcpServers = getMcpServers();
    const { tools, cleanup } = await convertMcpToLangchainTools(mcpServers);
    mcpCleanup = cleanup;

    const agent = createReactAgent({
      llm: llm as ChatOpenAI | AzureChatOpenAI, // Cast needed as getLlm has inferred type
      tools,
    });

    const result = await agent.invoke({ messages: langchainMessages });

    // Extract the last message content
    const lastMessage = result.messages[result.messages.length - 1];
    if (!lastMessage || typeof lastMessage.content !== "string") {
        console.error("LLM response content is not a string or message is missing:", lastMessage);
        throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Received unexpected response format from LLM.",
        });
    }
    responseContent = lastMessage.content;

    // Construct the response according to BackendResponseSchema
    const responseMessage: z.infer<typeof ChatMessageSchema> = {
      role: "agent", // Use 'agent' role as defined in schema
      text: responseContent,
      timestamp: new Date().toISOString(), // Generate a new timestamp
    };

    // For now, we don't update compliance data in this basic interaction
    // In a more complex scenario, the agent might modify input.complianceData
    // and return it here.
    const updatedComplianceData = undefined; // Or potentially input.complianceData if no changes

    return {
      newMessage: responseMessage,
      updatedComplianceData: updatedComplianceData, // Explicitly return undefined or the data
    };

  } catch (error: any) {
    console.error("Error invoking LLM agent:", error);
    // Re-throw TRPCError or wrap other errors
    if (error instanceof TRPCError) {
        throw error;
    }
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to get response from LLM agent: ${
        error.message || "Unknown error"
      }`,
    });
  } finally {
    // Ensure cleanup is called even if errors occur
    await mcpCleanup?.();
  }
};
