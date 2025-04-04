import { TRPCError } from "@trpc/server";
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

// Define the schema for a single message
interface Message {
  role: "user" | "assistant";
  content: string;
}

// Define the input for the agent service function
interface GenerateAgentResponseInput {
  messages: Message[];
  repositoryUrl?: string; // Included but not used yet
  complianceData?: any; // Included but not used yet
}

// Define the output for the agent service function
interface GenerateAgentResponseOutput {
  role: "assistant";
  content: string;
}

export const generateAgentResponse = async (
  input: GenerateAgentResponseInput
): Promise<GenerateAgentResponseOutput> => {
  const llm = getLlm();

  // Prepend the system message
  const systemMessage = new SystemMessage(
    "You are a general helper agent that can use MCP servers to help the user."
  );

  // Convert frontend messages to Langchain format
  const conversationHistory: (HumanMessage | AIMessage)[] = input.messages.map(
    (msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else {
        // assistant
        return new AIMessage(msg.content);
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

    return {
      role: "assistant",
      content: responseContent,
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
