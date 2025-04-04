import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { ChatOpenAI, AzureChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";

import {
  convertMcpToLangchainTools,
  McpServerCleanupFn,
} from "./langchainMcpTools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getMcpServers } from "./mcpServers";

const t = initTRPC.create();

// Define the schema for a single message in the conversation
const messageSchema = z.object({
  role: z.enum(["user", "assistant"]), // Adjust roles as needed based on frontend
  content: z.string(),
});

// Define the input schema for the generateResponse procedure
const generateResponseInputSchema = z.object({
  messages: z.array(messageSchema),
  repositoryUrl: z.string().optional(), // Included but not used yet
  complianceData: z.any().optional(), // Included but not used yet
});

// Function to get the appropriate LLM based on environment variables
// Remove explicit return type, let TypeScript infer ChatOpenAI | AzureChatOpenAI
const getLlm = () => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
  const azureInstanceName = process.env.AZURE_OPENAI_API_INSTANCE_NAME;
  const azureDeploymentName = process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME;
  const azureApiVersion = process.env.AZURE_OPENAI_API_VERSION;

  const hasOpenAIConfig = openaiApiKey;
  const hasAzureConfig =
    azureApiKey && azureInstanceName && azureDeploymentName && azureApiVersion;

  if (hasAzureConfig) {
    console.log("Using Azure OpenAI");
    // Construct the endpoint URL using the instance name
    const azureOpenAIEndpoint = `https://${azureInstanceName}.openai.azure.com/`; // Corrected parameter name suggestion
    return new AzureChatOpenAI({
      azureOpenAIApiKey: azureApiKey,
      azureOpenAIEndpoint: azureOpenAIEndpoint, // Use the corrected parameter name
      azureOpenAIApiDeploymentName: azureDeploymentName,
      azureOpenAIApiVersion: azureApiVersion,
      modelName: "o3-mini", // Optional: Specify model if needed, defaults usually work
      // reasoningEffort: "high", // optional to specify reasoning effort of agent
      temperature: 0.7, // Optional: Adjust temperature
    });
  } else if (hasOpenAIConfig) {
    // console.log("Using OpenAI");
    return new ChatOpenAI({
      openAIApiKey: openaiApiKey,
      modelName: "gpt-4o", // Optional: Specify model if needed
      temperature: 0.7, // Optional: Adjust temperature
    });
  } else {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "LLM provider not configured. Please set either OpenAI or Azure OpenAI credentials in the .env file.",
    });
  }
};

export const appRouter = t.router({
  generateResponse: t.procedure
    .input(generateResponseInputSchema)
    .mutation(async ({ input }) => {
      const llm = getLlm();

      // Prepend the system message
      const systemMessage = new SystemMessage(
        "You are a general helper agent that can use MCP servers to help the user."
      );

      // Convert frontend messages to Langchain format with specific types
      const conversationHistory: (HumanMessage | AIMessage)[] =
        input.messages.map((msg) => {
          if (msg.role === "user") {
            return new HumanMessage(msg.content);
          } else {
            // assistant
            return new AIMessage(msg.content);
          }
        });

      const langchainMessages = [systemMessage, ...conversationHistory];
      let mcpCleanup: McpServerCleanupFn | undefined;
      let response: string;
      try {
        // console.log(
        //   "Invoking llm with messages: ",
        //   JSON.stringify(langchainMessages, null, 2),
        //   "\n\n"
        // );
        // Note: repositoryUrl and complianceData are in 'input' but not used here yet
        const mcpServers = getMcpServers();
        const { tools, cleanup } = await convertMcpToLangchainTools(mcpServers);
        mcpCleanup = cleanup;
        const agent = createReactAgent({
          llm,
          tools,
        });
        const result = await agent.invoke({ messages: langchainMessages });

        response = result.messages[result.messages.length - 1].content.toString();
        // console.log("Received response from chain: ", response);

        // The response from the chain should be a BaseMessage (likely AIMessage)
        if (response && typeof response === "string") {
          return {
            role: "assistant",
            content: response,
          };
        } else {
          // Handle potential non-string content if necessary, maybe stringify?
          console.error(
            "LLM response content is not a string:",
            response
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Received unexpected response format from LLM.",
          });
        }
      } catch (error: any) {
        console.error("Error invoking LLM:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to get response from LLM: ${
            error.message || "Unknown error"
          }`,
        });
      } finally {
        await mcpCleanup?.();
      }
    }),
});

// Export type definition of API
export type AppRouter = typeof appRouter;
