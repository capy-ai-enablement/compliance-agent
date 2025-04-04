import React, { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo
import {
  ComplianceContentSchema,
  ComplianceData,
  initialComplianceData,
  ChatMessage,
  StoredChatMessage,
  ChatMessageSchema,
} from "./schema";
import { z } from "zod";
import SchemaFormRenderer from "./SchemaFormRenderer";
import { trpc } from "./trpc";
import { TRPCClientError } from "@trpc/client"; // Import for error handling

// --- Constants ---
const REPO_URL_STORAGE_KEY = "complianceAgentRepoUrl";
const COMPLIANCE_DATA_STORAGE_KEY = "complianceAgentData";
const CHAT_MESSAGES_STORAGE_KEY = "complianceAgentMessages";

// Define the keys for the main sections of the schema
type ComplianceSectionKey = keyof ComplianceData;

// Define the tabs based on the schema structure
const TABS: { key: ComplianceSectionKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "lawsAndRegulations", label: "Laws & Regulations" },
  { key: "dataPoints", label: "Data Points" },
  { key: "threatsAndVulnerabilities", label: "Threats & Vulnerabilities" },
];

function App() {
  const [repositoryUrl, setRepositoryUrl] = useState<string>("");
  const [complianceData, setComplianceData] = useState<ComplianceData>(
    initialComplianceData
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // const [isLoading, setIsLoading] = useState<boolean>(false); // Replaced by mutation.isPending
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ComplianceSectionKey>(TABS[0].key); // State for active tab

  // --- tRPC Mutation for generating response ---
  const generateResponseMutation = trpc.generateResponse.useMutation();

  // --- Load state from Local Storage on mount ---
  useEffect(() => {
    // Load Repository URL
    const storedRepoUrl = localStorage.getItem(REPO_URL_STORAGE_KEY);
    if (storedRepoUrl) {
      try {
        const parsedUrl = z.string().parse(storedRepoUrl);
        setRepositoryUrl(parsedUrl);
      } catch (e) {
        console.error("Failed to parse stored repository URL:", e);
        localStorage.removeItem(REPO_URL_STORAGE_KEY);
      }
    }

    // Load Compliance Data
    const storedComplianceData = localStorage.getItem(
      COMPLIANCE_DATA_STORAGE_KEY
    );
    if (storedComplianceData) {
      try {
        const parsedData = JSON.parse(storedComplianceData);
        // Use safeParse to handle potential schema mismatches after updates
        const complianceValidationResult =
          ComplianceContentSchema.safeParse(parsedData);
        if (complianceValidationResult.success) {
          // Merge loaded data with initial data to ensure all keys exist,
          // especially after schema changes.
          setComplianceData({
            ...initialComplianceData,
            ...complianceValidationResult.data,
          });
        } else {
          console.error(
            "Stored compliance data failed validation:",
            complianceValidationResult.error
          );
          setError(
            "Failed to load saved data due to structure mismatch. Resetting to default."
          );
          setComplianceData(initialComplianceData); // Reset to default if validation fails
          localStorage.removeItem(COMPLIANCE_DATA_STORAGE_KEY); // Clear corrupted data
        }
      } catch (e) {
        console.error("Failed to parse stored compliance data:", e);
        setError("Failed to load saved data. Resetting to default.");
        localStorage.removeItem(COMPLIANCE_DATA_STORAGE_KEY);
        setComplianceData(initialComplianceData);
      }
    }

    // Load Chat Messages
    const storedMessagesData = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
    if (storedMessagesData) {
      try {
        const parsedMessages = JSON.parse(storedMessagesData);
        const messagesValidationResult = z
          .array(ChatMessageSchema)
          .safeParse(parsedMessages);
        if (messagesValidationResult.success) {
          const runtimeMessages: ChatMessage[] =
            messagesValidationResult.data.map((msg) => ({
              ...msg,
              timestamp: new Date(msg.timestamp), // Convert ISO string back to Date
            }));
          setMessages(runtimeMessages);
        } else {
          console.error(
            "Stored chat messages failed validation:",
            messagesValidationResult.error
          );
          setError(
            "Failed to load chat history. It might be corrupted. Clearing history."
          );
          localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
          setMessages([]);
        }
      } catch (e) {
        console.error("Failed to parse stored chat messages:", e);
        setError("Failed to load chat history. Clearing history.");
        localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
        setMessages([]);
      }
    }
    setIsInitialLoad(false);
  }, []);

  // --- Save state to Local Storage on change ---
  useEffect(() => {
    if (repositoryUrl) {
      localStorage.setItem(REPO_URL_STORAGE_KEY, repositoryUrl);
    } else {
      localStorage.removeItem(REPO_URL_STORAGE_KEY);
    }
  }, [repositoryUrl]);

  useEffect(() => {
    if (isInitialLoad) return;
    try {
      localStorage.setItem(
        COMPLIANCE_DATA_STORAGE_KEY,
        JSON.stringify(complianceData)
      );
    } catch (e) {
      console.error("Failed to save compliance data:", e);
      setError("Failed to save progress.");
    }
  }, [complianceData, isInitialLoad]);

  useEffect(() => {
    if (isInitialLoad) return;
    try {
      const messagesToStore: StoredChatMessage[] = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(), // Convert Date to ISO string
      }));
      localStorage.setItem(
        CHAT_MESSAGES_STORAGE_KEY,
        JSON.stringify(messagesToStore)
      );
    } catch (e) {
      console.error("Failed to save chat messages:", e);
      setError("Failed to save chat history.");
    }
  }, [messages, isInitialLoad]);

  // --- Event Handlers ---
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRepositoryUrl(event.target.value);
    setError(null);
  };

  // handleTabDataChange removed as SchemaFormRenderer now updates the full state directly

  const handleSendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || generateResponseMutation.isPending) return; // Use mutation's loading state

      const userMessage: ChatMessage = {
        role: "user",
        text: messageText,
        timestamp: new Date(),
      };
      const currentMessages = [...messages, userMessage];
      setMessages(currentMessages); // Add user message immediately
      setError(null);

      // Prepare messages for the backend (map sender/text to role/content with type assertion)
      const messagesForBackend = currentMessages.map((msg) => ({
        role: (msg.role === "user" ? "user" : "assistant") as
          | "user"
          | "assistant", // Assert role type
        content: msg.text,
      }));

      try {
        const response = await generateResponseMutation.mutateAsync({
          messages: messagesForBackend,
          repositoryUrl: repositoryUrl || undefined, // Pass optional fields
          complianceData: complianceData || undefined,
        });

        // Add agent response
        const agentMessage: ChatMessage = {
          role: "agent",
          text: response.content, // Assuming response has { role: 'assistant', content: string }
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMessage]);
      } catch (err) {
        console.error("Error calling generateResponse:", err);
        let errorMessage = "Failed to get response from agent.";
        if (err instanceof TRPCClientError) {
          errorMessage = `Error: ${err.message}`; // Show specific tRPC error
        }
        setError(errorMessage);
        // Optionally remove the user's message if the call failed
        // setMessages(messages);
      }
    },
    [messages, repositoryUrl, complianceData, generateResponseMutation] // Add mutation to dependencies
  );

  const handleResetChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY);
    setError(null);
    console.log("Chat history cleared.");
  }, []);

  // --- Memoize Data for the Active Tab ---
  // activeSchema removed as it's no longer used directly by the renderer call
  const activeData = useMemo(() => {
    // Extract the data corresponding to the active tab
    return complianceData[activeTab];
  }, [complianceData, activeTab]);

  // --- Render ---
  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Left Panel: Repo URL + Compliance Data Form */}
      <div className="flex-grow flex flex-col p-4 overflow-hidden">
        {/* Repository URL Input */}
        <div className="mb-4">
          <label
            htmlFor="repoUrl"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Repository URL
          </label>
          <input
            type="url"
            id="repoUrl"
            value={repositoryUrl}
            onChange={handleUrlChange}
            placeholder="https://github.com/user/repo"
            className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Error Display (includes tRPC mutation errors now) - Removed duplicate block */}
        {(error || generateResponseMutation.error) && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            <strong>Error:</strong>{" "}
            {error || generateResponseMutation.error?.message}
          </div>
        )}

        {/* Compliance Data Form Area with Tabs */}
        <div className="flex-grow bg-white border border-gray-300 rounded-md overflow-hidden flex flex-col">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-4 px-4" aria-label="Tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`${
                    activeTab === tab.key
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                  aria-current={activeTab === tab.key ? "page" : undefined}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content Area - Add key here to reset content on tab change */}
          <div className="flex-grow overflow-auto" key={activeTab}>
            {isInitialLoad ? (
              <div className="p-4 text-gray-500">Loading form...</div>
            ) : (
              <SchemaFormRenderer
                // Pass the FULL schema, but data/path specific to the active tab
                schema={ComplianceContentSchema} // Pass the full schema
                data={activeData}
                onDataChange={setComplianceData} // Pass the main state setter directly
                path={[activeTab]} // Provide the initial path segment for the active tab
                fullData={complianceData} // Pass full data for context and updates
                // key={activeTab} removed from renderer itself
              />
            )}
          </div>
        </div>
      </div>

      {/* Right Panel: Chat Interface (Remains the same) */}
      <div className="w-96 flex flex-col bg-white border-l border-gray-300 shadow-lg">
        {/* Chat Header */}
        <div className="p-3 border-b border-gray-300 flex justify-between items-center bg-gray-50">
          <h2 className="text-md font-semibold text-gray-700">Conversation</h2>
          <button
            onClick={handleResetChat}
            className="px-3 py-1 text-lg font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={messages.length === 0}
            title="Clear Chat History"
          >
            +
          </button>
        </div>
        {/* Chat Messages Area */}
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p className="text-xs text-right mt-1 opacity-70">
                  {msg.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          {/* Use mutation's loading state */}
          {generateResponseMutation.isPending && (
            <div className="flex justify-start">
              <div className="px-4 py-2 rounded-lg shadow bg-gray-200 text-gray-500 italic">
                Agent is thinking...
              </div>
            </div>
          )}
        </div>
        {/* Chat Input Area */}
        <div className="p-4 border-t border-gray-300">
          <form
            onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem(
                "messageInput"
              ) as HTMLInputElement;
              if (input) {
                handleSendMessage(input.value);
                input.value = ""; // Clear input after sending
              }
            }}
          >
            <div className="flex space-x-2">
              <input
                type="text"
                name="messageInput"
                placeholder="Type your message..."
                className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                disabled={generateResponseMutation.isPending} // Disable input while loading
              />
              <button
                type="submit"
                className={`px-4 py-2 rounded-md text-white font-semibold ${
                  generateResponseMutation.isPending // Adjust button style/state based on mutation
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600"
                }`}
                disabled={generateResponseMutation.isPending} // Disable button while loading
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
