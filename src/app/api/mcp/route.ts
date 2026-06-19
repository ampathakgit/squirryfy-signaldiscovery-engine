import { NextRequest } from "next/server";
import { getMcpServer } from "@/lib/mcp";

// Disable Next.js route caching for the Event Stream GET endpoint
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { mcpTransport } = await getMcpServer();
  return mcpTransport.handleRequest(request);
}

export async function POST(request: NextRequest) {
  const { mcpTransport } = await getMcpServer();
  return mcpTransport.handleRequest(request);
}

export async function DELETE(request: NextRequest) {
  const { mcpTransport } = await getMcpServer();
  return mcpTransport.handleRequest(request);
}
