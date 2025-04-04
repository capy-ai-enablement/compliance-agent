import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"; // Added useRef
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
// Import schemas from the backend
import {
  ComplianceContentSchema,
  initialComplianceData,
  ChatMessageSchema,
} from "../../backend/src/schemas"; // Adjusted path
import type { ComplianceData } from "../../backend/src/schemas"; // Import type separately
import { z } from "zod";
import SchemaFormRenderer from "./SchemaFormRenderer";
// Import tRPC client and renamed inferred types
import { trpc, AgentRequestInput, AgentResponseOutput } from "./trpc";
import { TRPCClientError } from "@trpc/client";

// Define the runtime ChatMessage type locally (using Date object)
type ChatMessage = {
  role: "user" | "agent";
  text: string;
  timestamp: Date;
};

// Define the stored ChatMessage type (using string timestamp) - inferred from schema
type StoredChatMessage = z.infer<typeof ChatMessageSchema>;

// --- Constants ---
const REPO_URL_STORAGE_KEY = "complianceAgentRepoUrl";
const COMPLIANCE_DATA_STORAGE_KEY = "complianceAgentData";
const CHAT_MESSAGES_STORAGE_KEY = "complianceAgentMessages";

// Define the keys for the main sections of the schema (remains the same)
type ComplianceSectionKey = keyof ComplianceData;

// Define the tabs based on the schema structure (remains the same)
const TABS: { key: ComplianceSectionKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "lawsAndRegulations", label: "Laws & Regulations" },
  { key: "dataPoints", label: "Data Points" },
  { key: "threatsAndVulnerabilities", label: "Threats & Vulnerabilities" },
];

function App() {
  const [repositoryUrl, setRepositoryUrl] = useState<string>("");
  const [complianceData, setComplianceData] = useState<ComplianceData>(
    initialComplianceData // Use imported initial data
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]); // Uses local runtime ChatMessage type
  const [error, setError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ComplianceSectionKey>(TABS[0].key); // State for active tab
  const [chatPanelWidth, setChatPanelWidth] = useState<number>(384); // Initial width (w-96 = 24rem = 384px)
  const isResizing = useRef<boolean>(false); // Ref to track resizing state

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
        const parsedStoredMessages = JSON.parse(storedMessagesData);
        // Validate against the imported ChatMessageSchema
        const messagesValidationResult = z
          .array(ChatMessageSchema)
          .safeParse(parsedStoredMessages);
        if (messagesValidationResult.success) {
          // Map stored format (string timestamp) to runtime format (Date object)
          const runtimeMessages: ChatMessage[] =
            messagesValidationResult.data.map((msg: StoredChatMessage) => ({
              role: msg.role,
              text: msg.text,
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
      // Map runtime format (Date object) back to stored format (string timestamp)
      const messagesToStore: StoredChatMessage[] = messages.map((msg) => ({
        role: msg.role,
        text: msg.text,
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
      if (!messageText.trim() || generateResponseMutation.isPending) return;

      // --- Frontend Validation ---
      // Use the placeholder URL if the input is empty, otherwise use the input
      const defaultRepoUrl =
        "https://github.com/capy-ai-enablement/compliance-agent";
      const urlToUse =
        repositoryUrl.trim() === "" ? defaultRepoUrl : repositoryUrl;

      // Validate the URL that will be used (either user input or default)
      const urlValidation = z.string().url().safeParse(urlToUse);
      if (!urlValidation.success) {
        // Only show error if the user actually typed something invalid
        if (repositoryUrl.trim() !== "") {
          setError(
            "Please enter a valid repository URL or leave it blank to use the default."
          );
          return; // Stop execution if user input is invalid
        } else {
          // If the default URL is somehow invalid (should not happen), log error but proceed
          console.error(
            "Default repository URL failed validation:",
            urlValidation.error
          );
          // Optionally, you could set an error state here too, but it might be confusing
          // setError("Default repository URL seems invalid. Please contact support.");
          // return; // Decide if you want to block sending even if the default is broken
        }
      }
      // --- End Frontend Validation ---

      // Create runtime user message
      const userMessage: ChatMessage = {
        role: "user",
        text: messageText,
        timestamp: new Date(),
      };
      const currentRuntimeMessages = [...messages, userMessage];
      setMessages(currentRuntimeMessages); // Add user message immediately (runtime format)
      setError(null);

      // Prepare payload for the backend using GenerateResponseInput type
      // Map runtime messages (Date) to stored format (string timestamp) for the API call
      const messagesForBackend: StoredChatMessage[] =
        currentRuntimeMessages.map((msg) => ({
          role: msg.role,
          text: msg.text,
          timestamp: msg.timestamp.toISOString(),
        }));

      // Use the renamed input type
      const payload: AgentRequestInput = {
        messages: messagesForBackend,
        repositoryUrl: urlToUse, // Pass the determined URL (user input or default)
        complianceData: complianceData, // Pass complianceData (required by backend schema)
      };

      try {
        // Use the renamed output type
        const response: AgentResponseOutput =
          await generateResponseMutation.mutateAsync(payload);

        // Process agent response (newMessage is in StoredChatMessage format)
        const agentMessage: ChatMessage = {
          role: response.newMessage.role,
          text: response.newMessage.text,
          timestamp: new Date(response.newMessage.timestamp), // Convert string timestamp to Date
        };
        setMessages((prev) => [...prev, agentMessage]);

        // Update compliance data if the backend provided it
        if (response.updatedComplianceData) {
          // Validate the received compliance data before setting state
          const validationResult = ComplianceContentSchema.safeParse(
            response.updatedComplianceData
          );
          if (validationResult.success) {
            setComplianceData(validationResult.data);
          } else {
            console.error(
              "Received invalid compliance data from backend:",
              validationResult.error
            );
            setError(
              "Received invalid data structure from the agent. Please check backend logs."
            );
          }
        }
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

  // --- Resize Handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection during drag
    isResizing.current = true;
    // Add global listeners in useEffect below
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;
    // Calculate new width based on mouse position relative to the right edge of the window
    const newWidth = window.innerWidth - e.clientX;
    // Add constraints (e.g., min 200px, max 800px)
    const minWidth = 200;
    const maxWidth = 800;
    const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
    setChatPanelWidth(constrainedWidth);
  }, []); // No dependencies needed as it reads window/event properties

  const handleMouseUp = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      // Remove global listeners in useEffect below
      // Optional: Save width to local storage here
      // localStorage.setItem('chatPanelWidth', chatPanelWidth.toString());
    }
  }, []); // No dependencies needed

  // --- Add/Remove Global Event Listeners for Resize ---
  useEffect(() => {
    // Only add listeners if resizing is active (controlled by handleMouseDown/Up)
    // This effect runs when handleMouseMove or handleMouseUp functions change,
    // which they don't, but it's standard practice to include them if used inside.
    // A better approach might be to add/remove listeners directly in Down/Up handlers,
    // but this useEffect pattern is also common.

    // Let's refine: Add listeners on mount, remove on unmount.
    // The actual logic execution is controlled by isResizing.current.
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // Cleanup function to remove listeners when component unmounts
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]); // Re-attach if handlers change (they won't here)


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
            placeholder="https://github.com/capy-ai-enablement/compliance-agent"
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

      {/* Drag Handle */}
      <div
        className="w-2 cursor-col-resize bg-gray-300 hover:bg-gray-400 active:bg-gray-500 flex-shrink-0" // Use flex-shrink-0 class
        // style={{ flexShrink: 0 }} // Redundant if using class
        onMouseDown={handleMouseDown} // Attach mouse down handler
      ></div>

      {/* Right Panel: Chat Interface */}
      {/* Use inline style for dynamic width, remove fixed width class */}
      <div
        className="flex flex-col bg-white border-l border-gray-300 shadow-lg flex-shrink-0" // Use flex-shrink-0 class
        style={{ width: `${chatPanelWidth}px` }} // Apply dynamic width only
      >
        {/* Chat Header */}
        <div className="p-3 border-b border-gray-300 flex justify-between items-center bg-gray-50 flex-shrink-0"> {/* Prevent header shrink */}
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
                {/* Wrap ReactMarkdown in a div for styling, add prose-invert for user messages */}
                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
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
