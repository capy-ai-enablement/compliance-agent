import { TRPCError } from "@trpc/server";
import { ChatOpenAI, AzureChatOpenAI } from "@langchain/openai";

// Function to get the appropriate LLM based on environment variables
// Remove explicit return type, let TypeScript infer ChatOpenAI | AzureChatOpenAI
export const getLlm = () => {
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
