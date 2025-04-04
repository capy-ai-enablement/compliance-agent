import React, { useState, useEffect, useCallback } from "react";
import {
  ComplianceContentSchema, // Import the schema itself
  ComplianceData,
  initialComplianceData,
  ChatMessage,
  // BackendPayload, // For future use
  // BackendResponseSchema // For future use
} from "./schema"; // Assuming schema.ts is in the same directory
import { z } from "zod";
import SchemaFormRenderer from "./SchemaFormRenderer"; // Import the new component

import {
  ChatMessageSchema, // Import the schema for validation
  StoredChatMessage, // Import the type for stored messages
  // ... other imports
} from "./schema";
// ... other imports

// --- Local Storage Keys ---
const REPO_URL_STORAGE_KEY = "complianceAgentRepoUrl";
const COMPLIANCE_DATA_STORAGE_KEY = "complianceAgentData";
const CHAT_MESSAGES_STORAGE_KEY = "complianceAgentMessages";

function App() {
  const [repositoryUrl, setRepositoryUrl] = useState<string>("");
  const [complianceData, setComplianceData] = useState<ComplianceData>(
    initialComplianceData
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false); // For future API calls
  const [error, setError] = useState<string | null>(null); // For displaying errors
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true); // Flag for initial load

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
    const storedComplianceData = localStorage.getItem(COMPLIANCE_DATA_STORAGE_KEY);
    if (storedComplianceData) {
      try {
        const parsedData = JSON.parse(storedComplianceData);
        const complianceValidationResult = ComplianceContentSchema.safeParse(parsedData);
        if (complianceValidationResult.success) {
          setComplianceData(complianceValidationResult.data);
        } else {
          console.error("Stored compliance data failed validation:", complianceValidationResult.error);
          setError("Failed to load saved data. It might be corrupted. Resetting to default.");
          setComplianceData(initialComplianceData);
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
        const messagesValidationResult = z.array(ChatMessageSchema).safeParse(parsedMessages);
        if (messagesValidationResult.success) {
          const runtimeMessages: ChatMessage[] = messagesValidationResult.data.map((msg) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(runtimeMessages);
        } else {
          console.error("Stored chat messages failed validation:", messagesValidationResult.error);
          setError("Failed to load chat history. It might be corrupted. Clearing history.");
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
    setIsInitialLoad(false); // Mark initial load as complete
  }, []); // Runs only once on mount

  // --- Save state to Local Storage on change ---

  // Save repositoryUrl
  useEffect(() => {
    if (repositoryUrl) {
      localStorage.setItem(REPO_URL_STORAGE_KEY, repositoryUrl);
    } else {
      localStorage.removeItem(REPO_URL_STORAGE_KEY);
    }
  }, [repositoryUrl]);

  // Save complianceData (only after initial load)
  useEffect(() => {
    if (isInitialLoad) {
      return;
    }
    try {
      localStorage.setItem(COMPLIANCE_DATA_STORAGE_KEY, JSON.stringify(complianceData));
    } catch (e) {
      console.error("Failed to save compliance data to local storage:", e);
      setError("Failed to save progress.");
    }
  }, [complianceData, isInitialLoad]);

  // Save messages (only after initial load)
  useEffect(() => {
    if (isInitialLoad) {
      return;
    }
    try {
      const messagesToStore: StoredChatMessage[] = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }));
      localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messagesToStore));
    } catch (e) {
      console.error("Failed to save chat messages to local storage:", e);
      setError("Failed to save chat history.");
    }
  }, [messages, isInitialLoad]);

  // --- Event Handlers ---
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRepositoryUrl(event.target.value);
    setError(null);
  };

  const handleSendMessage = useCallback(
    async (messageText: string) => {
      if (!messageText.trim() || isLoading) return;
      const userMessage: ChatMessage = { sender: "user", text: messageText, timestamp: new Date() };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      // --- Mock Backend Interaction ---
      const messagesForBackend: StoredChatMessage[] = [...messages, userMessage].map((msg) => ({ ...msg, timestamp: msg.timestamp.toISOString() }));
      console.log("Sending to backend (mock):", { repositoryUrl, complianceData, messages: messagesForBackend }); // Keep mock log for now
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const mockAgentResponseStored: StoredChatMessage = { sender: "agent", text: `Received: "${messageText}". I'm just a mock response for now.`, timestamp: new Date().toISOString() };
      // Example of how backend might update compliance data - currently not used by mock
      // const mockUpdatedData = { ...complianceData, lawsAndRegulations: [...complianceData.lawsAndRegulations, `Mock Law related to "${messageText.substring(0, 10)}..."`] };
      const mockAgentResponseRuntime: ChatMessage = { ...mockAgentResponseStored, timestamp: new Date(mockAgentResponseStored.timestamp) };
      setMessages((prev) => [...prev, mockAgentResponseRuntime]);
      // If backend could update compliance data, we'd call setComplianceData here
      // setComplianceData(mockUpdatedData);
      console.log("Received from backend (mock):", { newMessage: mockAgentResponseStored /*, updatedComplianceData: mockUpdatedData */ }); // Keep mock log
      // --- End Mock Backend Interaction ---

      setIsLoading(false);
    },
    [repositoryUrl, complianceData, messages, isLoading]
  );

  // --- Render ---
  return (
     <div className="flex h-screen bg-gray-100 font-sans">
      {/* Left Panel: Repo URL + Compliance Data Form */}
      <div className="flex-grow flex flex-col p-4 overflow-hidden">
        {/* Repository URL Input */}
        <div className="mb-4">
          <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-1">Repository URL</label>
          <input type="url" id="repoUrl" value={repositoryUrl} onChange={handleUrlChange} placeholder="https://github.com/user/repo" className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
        </div>
        {/* Error Display */}
        {error && (<div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded"><strong>Error:</strong> {error}</div>)}
        {/* Compliance Data Form Area */}
        <div className="flex-grow bg-white border border-gray-300 rounded-md overflow-hidden flex flex-col">
          <h2 className="text-lg font-semibold p-4 pb-2 text-gray-800 border-b border-gray-200">Compliance Data Form</h2>
          <div className="flex-grow overflow-auto">
            {isInitialLoad ? (<div className="p-4 text-gray-500">Loading form...</div>) : (
              <SchemaFormRenderer
                schema={ComplianceContentSchema}
                data={complianceData}
                onDataChange={setComplianceData}
                fullData={complianceData}
              />
            )}
          </div>
        </div>
      </div>
      {/* Right Panel: Chat Interface */}
      <div className="w-96 flex flex-col bg-white border-l border-gray-300 shadow-lg">
        {/* Chat Messages Area */}
        <div className="flex-grow p-4 overflow-y-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${ msg.sender === "user" ? "justify-end" : "justify-start" }`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${ msg.sender === "user" ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-800" }`}>
                <p className="text-sm">{msg.text}</p>
                <p className="text-xs text-right mt-1 opacity-70">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {isLoading && (<div className="flex justify-start"><div className="px-4 py-2 rounded-lg shadow bg-gray-200 text-gray-500 italic">Agent is thinking...</div></div>)}
        </div>
        {/* Chat Input Area */}
        <div className="p-4 border-t border-gray-300">
          <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const input = e.currentTarget.elements.namedItem("messageInput") as HTMLInputElement; if (input) { handleSendMessage(input.value); input.value = ""; } }}>
            <div className="flex space-x-2">
              <input type="text" name="messageInput" placeholder="Type your message..." className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" disabled={isLoading}/>
              <button type="submit" className={`px-4 py-2 rounded-md text-white font-semibold ${ isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-600" }`} disabled={isLoading}>Send</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
