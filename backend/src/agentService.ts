import { TRPCError } from "@trpc/server";
import { z } from "zod"; // Import zod
// Import the centralized schemas/types with updated names
import {
  AgentRequest, // Renamed from BackendPayload
  AgentResponse, // Renamed from BackendResponse
  ChatMessageSchema, // Needed for constructing the response message
  ComplianceContentSchema, // Import the main schema for the parser
  StoredChatMessage, // Import this type for explicit typing
  ComplianceData, // Import the ComplianceData type
} from "./schemas";
import { StructuredOutputParser } from "@langchain/core/output_parsers"; // Import the parser
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
// Re-enable createReactAgent
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMcpServers } from "./mcpServers";
import { getLlm } from "./llm";
import { ChatOpenAI, AzureChatOpenAI } from "@langchain/openai";

// Old interfaces are removed, using imported types now

export const generateAgentResponse = async (
  input: AgentRequest // Use the renamed AgentRequest type
): Promise<AgentResponse> => {
  // Return type is now AgentResponse
  const llm = getLlm();

  // Create the structured output parser
  const parser = StructuredOutputParser.fromZodSchema(ComplianceContentSchema);

  // Prepend the system message, instructing the React Agent about structured output
  // Note: React agent might add conversational text around the JSON. We'll parse the last message.
  const systemPrompt = new SystemMessage(
    `You are a compliance helper agent. Use the available tools to analyze the repository at ${
      input.repositoryUrl
    } and assist the user in building a compliance report.
The current state of the report is: ${JSON.stringify(input.complianceData)}

Your primary goal is to update this compliance report based on the user's request and your findings from tool usage. When the users asks to update the compliance data you are to include a updatedComplianceData in your response.
After completing your reasoning and any necessary tool calls, your FINAL response message MUST be ONLY the updated compliance data formatted as a JSON object adhering to the following schema. Do NOT include any other text, explanations, or conversational filler in the final message content itself; just the JSON. DO NOT include backticks \`\`\` or any other text, just the JSON output as it will be parsed DIRECTLY through a JSON parser.

JSON Schema for the final output:
${parser.getFormatInstructions()}`
  );

  // Convert frontend messages (StoredChatMessage format) to Langchain format
  const conversationHistory: (HumanMessage | AIMessage)[] = input.messages.map(
    (msg: StoredChatMessage) => {
      // Add explicit type for msg
      // msg now has { role: 'user' | 'agent', text: string, timestamp: string }
      if (msg.role === "user") {
        return new HumanMessage(msg.text); // Use msg.text
      } else {
        // agent
        return new AIMessage(msg.text); // Use msg.text
      }
    }
  );

  const langchainMessages: BaseMessage[] = [
    systemPrompt,
    ...conversationHistory,
  ];
  let mcpCleanup: McpServerCleanupFn | undefined;
  let responseContent: string;

  try {
    const mcpServers = getMcpServers();
    const { tools, cleanup } = await convertMcpToLangchainTools(mcpServers);
    mcpCleanup = cleanup;

    // Create the React Agent
    const agent = createReactAgent({
      llm,
      tools,
      // We provide the system message directly in the messages array below
    });

    // Invoke the React Agent
    const agentResult = await agent.invoke({ messages: langchainMessages });

    // Extract the *last* message content from the agent's response sequence
    const lastMessage = agentResult.messages[agentResult.messages.length - 1];
    if (
      !lastMessage ||
      typeof lastMessage.content !== "string" ||
      lastMessage.content.trim() === ""
    ) {
      console.error(
        "Agent's final message content is not a non-empty string or message is missing:",
        lastMessage
      );
      // Provide a generic error message if the agent failed to respond correctly
      const errorResponseMessage: z.infer<typeof ChatMessageSchema> = {
        role: "agent",
        text: "Sorry, I encountered an issue generating the response. Please check the logs.",
        timestamp: new Date().toISOString(),
      };
      return {
        newMessage: errorResponseMessage,
        updatedComplianceData: undefined,
      };
      // Or throw TRPCError if preferred:
      // throw new TRPCError({
      //   code: "INTERNAL_SERVER_ERROR",
      //   message: "Received unexpected final response format from agent.",
      // });
    }
    responseContent = lastMessage.content; // This should be the JSON string

    let parsedData: ComplianceData | undefined;
    let chatMessageText: string;

    try {
      // Attempt to parse the structured data from the agent's final message
      parsedData = await parser.parse(responseContent);
      // If parsing succeeds, create a user-friendly chat message
      chatMessageText =
        "I've updated the compliance data based on your request and my findings.";
      console.log(
        "Successfully parsed compliance data from agent:",
        parsedData
      );
    } catch (parseError) {
      console.error(
        "Failed to parse agent's final message into structured data:",
        parseError
      );
      console.error("Raw final message content:", responseContent);
      // If parsing fails, use a message indicating the issue and potentially include the raw response
      chatMessageText = `I gathered some information, but had trouble formatting the final compliance data update. Here's the raw response: \n\n${responseContent}`;
      // parsedData remains undefined
    }

    // Construct the response message
    const responseMessage: z.infer<typeof ChatMessageSchema> = {
      role: "agent",
      text: chatMessageText,
      timestamp: new Date().toISOString(),
    };

    // Return the new message and the parsed compliance data (if successful)
    return {
      newMessage: responseMessage,
      updatedComplianceData: parsedData, // This will be undefined if parsing failed
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
