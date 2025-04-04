import React, { useState, useEffect, useCallback } from 'react';
import {
    ComplianceContentSchema,
    ComplianceData,
    initialComplianceData,
    ChatMessage,
    // BackendPayload, // For future use
    // BackendResponseSchema // For future use
} from './schema'; // Assuming schema.ts is in the same directory
import { z } from 'zod';
import JSONInput from 'react-json-editor-ajrm';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - react-json-editor-ajrm doesn't have great types for locale
import locale from 'react-json-editor-ajrm/locale/en';


import {
    ChatMessageSchema, // Import the schema for validation
    StoredChatMessage, // Import the type for stored messages
    // ... other imports
} from './schema';
// ... other imports

// --- Local Storage Keys ---
const REPO_URL_STORAGE_KEY = 'complianceAgentRepoUrl';
const COMPLIANCE_DATA_STORAGE_KEY = 'complianceAgentData';
const CHAT_MESSAGES_STORAGE_KEY = 'complianceAgentMessages'; // New key for messages

function App() {
    const [repositoryUrl, setRepositoryUrl] = useState<string>('');
    const [complianceData, setComplianceData] = useState<ComplianceData>(initialComplianceData);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false); // For future API calls
    const [error, setError] = useState<string | null>(null); // For displaying errors
    const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true); // Flag for initial load

    // --- Load state from Local Storage on mount ---
    useEffect(() => {
        console.log("Effect: Loading from localStorage START");
        // Load Repository URL
        const storedRepoUrl = localStorage.getItem(REPO_URL_STORAGE_KEY);
        if (storedRepoUrl) {
            try {
                const parsedUrl = z.string().parse(storedRepoUrl);
                console.log("Effect: Loaded Repo URL:", parsedUrl);
                setRepositoryUrl(parsedUrl);
            } catch (e) {
                console.error("Failed to parse stored repository URL:", e);
                localStorage.removeItem(REPO_URL_STORAGE_KEY); // Clear invalid data
            }
        } else {
             console.log("Effect: No Repo URL found in localStorage.");
        }

        // Load Compliance Data
        const storedComplianceData = localStorage.getItem(COMPLIANCE_DATA_STORAGE_KEY);
        if (storedComplianceData) {
            try {
                const parsedData = JSON.parse(storedComplianceData);
                // Validate against the schema before setting state
                const complianceValidationResult = ComplianceContentSchema.safeParse(parsedData);
                if (complianceValidationResult.success) {
                    console.log("Effect: Loaded valid Compliance Data:", complianceValidationResult.data);
                    setComplianceData(complianceValidationResult.data);
                } else {
                    console.error("Stored compliance data failed validation:", complianceValidationResult.error);
                    setError("Failed to load saved data. It might be corrupted. Resetting to default.");
                    localStorage.removeItem(COMPLIANCE_DATA_STORAGE_KEY); // Clear invalid data
                    setComplianceData(initialComplianceData); // Reset to initial
                }
            } catch (e) {
                console.error("Failed to parse stored compliance data:", e);
                setError("Failed to load saved data. Resetting to default.");
                localStorage.removeItem(COMPLIANCE_DATA_STORAGE_KEY); // Clear invalid data
                setComplianceData(initialComplianceData); // Reset on parse error
            }
        } else {
             console.log("Effect: No Compliance Data found in localStorage.");
        }

        // Load Chat Messages
        const storedMessagesData = localStorage.getItem(CHAT_MESSAGES_STORAGE_KEY);
        if (storedMessagesData) {
            try {
                const parsedMessages = JSON.parse(storedMessagesData);
                // Validate the array of messages with string timestamps
                const messagesValidationResult = z.array(ChatMessageSchema).safeParse(parsedMessages);

                if (messagesValidationResult.success) {
                    // Convert string timestamps back to Date objects for runtime state
                    const runtimeMessages: ChatMessage[] = messagesValidationResult.data.map(msg => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp), // Parse ISO string back to Date
                    }));
                    console.log("Effect: Loaded valid Messages:", runtimeMessages);
                    setMessages(runtimeMessages);
                } else {
                    console.error("Stored chat messages failed validation:", messagesValidationResult.error);
                    setError("Failed to load chat history. It might be corrupted. Clearing history.");
                    localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY); // Clear invalid data
                    setMessages([]); // Reset to empty
                }
            } catch (e) {
                 console.error("Failed to parse stored chat messages:", e);
                 setError("Failed to load chat history. Clearing history.");
                 localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY); // Clear invalid data
                 setMessages([]); // Reset on parse error
            }
        } else {
             console.log("Effect: No Messages found in localStorage.");
         }
         console.log("Effect: Loading from localStorage END");
         setIsInitialLoad(false); // Mark initial load as complete
     }, []); // Empty dependency array ensures this runs only once on mount

    // --- Save state to Local Storage on change ---
    useEffect(() => {
        if (repositoryUrl) {
            localStorage.setItem(REPO_URL_STORAGE_KEY, repositoryUrl);
        } else {
            // Optionally remove if empty, or keep empty string
             localStorage.removeItem(REPO_URL_STORAGE_KEY);
        }
    }, [repositoryUrl]);

    useEffect(() => {
        try {
            localStorage.setItem(COMPLIANCE_DATA_STORAGE_KEY, JSON.stringify(complianceData));
        } catch (e) {
            console.error("Failed to save compliance data to local storage:", e);
            setError("Failed to save progress.");
        }
    }, [complianceData]);

    // Save messages to local storage
     useEffect(() => {
        // Only save after the initial load is complete
        if (isInitialLoad) {
            return;
        }
        try {
            // Convert Date objects back to ISO strings before saving
            const messagesToStore: StoredChatMessage[] = messages.map(msg => ({
                ...msg,
                timestamp: msg.timestamp.toISOString(), // Convert Date to ISO string
            }));
            localStorage.setItem(CHAT_MESSAGES_STORAGE_KEY, JSON.stringify(messagesToStore));
        } catch (e) {
            console.error("Failed to save chat messages to local storage:", e);
            setError("Failed to save chat history.");
        }
    }, [messages, isInitialLoad]); // Run whenever messages or isInitialLoad changes (after initial load)

    // --- Event Handlers ---
    const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRepositoryUrl(event.target.value);
        setError(null); // Clear error on new input
    };

    // Callback for the JSON editor
    const handleComplianceDataChange = useCallback((editorState: { jsObject?: ComplianceData, error?: unknown }) => {
        if (editorState.error) {
            // The editor itself might flag syntax errors
            console.warn("JSON Editor reported an error:", editorState.error);
            // Don't update state if there's a syntax error in the editor
            // Optionally set a specific error message for syntax issues
            // setError("Invalid JSON syntax.");
            return;
        }

        if (editorState.jsObject !== undefined) {
            // Validate the structured data against our Zod schema
            const validationResult = ComplianceContentSchema.safeParse(editorState.jsObject);
            if (validationResult.success) {
                // Only update state if the data is valid according to the schema
                setComplianceData(validationResult.data);
                setError(null); // Clear previous errors if valid
            } else {
                // Handle validation errors - don't update state, show an error
                console.error("Compliance data validation failed:", validationResult.error);
                // Provide more specific feedback if possible
                const formattedError = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
                setError(`Invalid data structure: ${formattedError}`);
            }
        }
    }, []); // Dependency array is empty as it only uses setters and schemas defined outside


    // Placeholder for sending message and interacting with backend
    const handleSendMessage = useCallback(async (messageText: string) => {
        if (!messageText.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            sender: 'user',
            text: messageText,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        setError(null);

        // --- Mock Backend Interaction ---
        // Prepare payload with string timestamps for backend (good practice)
        const messagesForBackend: StoredChatMessage[] = [...messages, userMessage].map(msg => ({
             ...msg,
             timestamp: msg.timestamp.toISOString(),
        }));
        console.log("Sending to backend (mock):", {
            repositoryUrl,
            complianceData,
            messages: messagesForBackend, // Send with string timestamps
        });

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock response (simulate backend sending string timestamp)
        const mockAgentResponseStored: StoredChatMessage = {
            sender: 'agent',
            text: `Received: "${messageText}". I'm just a mock response for now.`,
            timestamp: new Date().toISOString(), // Send string timestamp
        };
        // Mock compliance data update (optional) - e.g., add a dummy law
        const mockUpdatedData = {
            ...complianceData,
            lawsAndRegulations: [...complianceData.lawsAndRegulations, `Mock Law related to "${messageText.substring(0,10)}..."`]
        };

        // Simulate receiving response and converting timestamp back to Date for runtime state
        const mockAgentResponseRuntime: ChatMessage = {
            ...mockAgentResponseStored,
            timestamp: new Date(mockAgentResponseStored.timestamp), // Convert back to Date
        };
        setMessages(prev => [...prev, mockAgentResponseRuntime]);

        // Uncomment below to simulate data update from backend
        // handleComplianceDataChange(mockUpdatedData); // Assuming handleComplianceDataChange expects ComplianceData type

        console.log("Received from backend (mock):", { newMessage: mockAgentResponseStored, updatedComplianceData: mockUpdatedData });
        // --- End Mock Backend Interaction ---


        // TODO: Replace mock with actual fetch call to backend API
        /*
        try {
            const payload: BackendPayload = {
                repositoryUrl,
                complianceData,
                messages: [...messages, userMessage],
            };
            // Validate payload before sending (optional but good practice)
            // BackendPayloadSchema.parse(payload);

            const response = await fetch('/api/compliance', { // Replace with your actual API endpoint
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const result = await response.json();
            const validationResult = BackendResponseSchema.safeParse(result);

            if (validationResult.success) {
                const { newMessage, updatedComplianceData } = validationResult.data;
                setMessages(prev => [...prev, newMessage]);
                if (updatedComplianceData) {
                    handleComplianceDataChange(updatedComplianceData);
                }
            } else {
                console.error("Invalid response from backend:", validationResult.error);
                setError("Received invalid data from the server.");
                // Maybe add the raw text as an error message?
                 setMessages(prev => [...prev, { sender: 'agent', text: "Error: Received invalid response.", timestamp: new Date() }]);
            }

        } catch (err) {
            console.error("Failed to send message:", err);
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
             setMessages(prev => [...prev, { sender: 'agent', text: `Error: ${err instanceof Error ? err.message : "Failed to communicate"}`, timestamp: new Date() }]);
        } finally {
            setIsLoading(false);
        }
        */
       setIsLoading(false); // Remove this when using actual fetch

    }, [repositoryUrl, complianceData, messages, isLoading, handleComplianceDataChange]);


    // --- Render ---
    console.log("Render: Current complianceData state:", complianceData); // Log state before render
    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Left Panel: Repo URL + Compliance Data Editor */}
            <div className="flex-grow flex flex-col p-4 overflow-hidden">
                {/* Repository URL Input */}
                <div className="mb-4">
                    <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700 mb-1">
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

                 {/* Error Display */}
                 {error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                        <strong>Error:</strong> {error}
                    </div>
                )}

                 {/* Compliance Data Display/Editor Area */}
                 <div className="flex-grow bg-white border border-gray-300 rounded-md overflow-hidden flex flex-col">
                     <h2 className="text-lg font-semibold p-4 pb-2 text-gray-800 border-b border-gray-200">
                         Compliance Data Editor {/* Removed duplicate h2 */}
                    </h2>
                     <div className="flex-grow overflow-auto"> {/* Ensure this div takes up remaining space */}
                          {/* JSON Editor Component */}
                          <JSONInput
                             // Add a key that changes when the data is loaded/reset
                             // Stringify is simple but potentially slow for large objects; consider a unique ID if performance becomes an issue.
                             key={`json-editor-${JSON.stringify(complianceData)}`}
                             id='compliance-json-editor'
                             // placeholder now correctly initializes the editor due to the key change
                            placeholder={complianceData}
                            // Pass the locale for labels/messages
                            locale={locale}
                            // Callback for when the content changes and is valid JSON
                            onChange={handleComplianceDataChange}
                            // Style properties
                            height='100%' // Fill available vertical space
                            width='100%' // Fill available horizontal space
                            // Theme options: 'light_mitsuketa_tribute' (default), 'dark_vscode_tribute', etc.
                            theme="light_mitsuketa_tribute"
                            // View options
                            viewOnly={false} // Allow editing
                            confirmGood={false} // Don't show confirmation checkmarks
                            style={{
                                outerBox: { border: 'none', height: '100%' }, // Remove default border, ensure height works
                                container: { borderRadius: '0' }, // Remove internal border radius if needed
                                // You might need to adjust other styles via props if needed
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Right Panel: Chat Interface */}
            <div className="w-96 flex flex-col bg-white border-l border-gray-300 shadow-lg">
                {/* Chat Messages Area */}
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${
                                    msg.sender === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-gray-200 text-gray-800'
                                }`}
                            >
                                <p className="text-sm">{msg.text}</p>
                                <p className="text-xs text-right mt-1 opacity-70">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}
                     {isLoading && (
                         <div className="flex justify-start">
                            <div className="px-4 py-2 rounded-lg shadow bg-gray-200 text-gray-500 italic">
                                Agent is thinking...
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Input Area */}
                <div className="p-4 border-t border-gray-300">
                    <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                        e.preventDefault();
                        const input = e.currentTarget.elements.namedItem('messageInput') as HTMLInputElement;
                        if (input) {
                            handleSendMessage(input.value);
                            input.value = ''; // Clear input after sending
                        }
                    }}>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                name="messageInput"
                                placeholder="Type your message..."
                                className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                className={`px-4 py-2 rounded-md text-white font-semibold ${
                                    isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
                                }`}
                                disabled={isLoading}
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
