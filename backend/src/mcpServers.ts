/* Credit in part to hideya from: https://github.com/hideya/langchain-mcp-tools-ts-usage/blob/main/src/index.ts

MIT License

Copyright (c) 2025 hideya

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { McpServersConfig } from "./langchainMcpTools";

export function getMcpServers(): McpServersConfig {
  const mcpServers: McpServersConfig = {
    // filesystem: {
    //   command: "npx",
    //   args: [
    //     "-y",
    //     "@modelcontextprotocol/server-filesystem",
    //     ".", // path to a directory to allow access to
    //   ],
    // },
    fetch: {
      command: "uvx",
      args: ["mcp-server-fetch"],
    }
  };

  if (process.env.BRAVE_API_KEY) {
    mcpServers.braveSearch = {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-brave-search"],
      env: {
        BRAVE_API_KEY: process.env.BRAVE_API_KEY,
      },
    };
  }

  if (process.env.GITHUB_API_KEY) {
    mcpServers.github = {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
      env: {
        GITHUB_API_KEY: process.env.GITHUB_API_KEY,
      },
    };
  }

  return mcpServers;
}
