import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Construct paths dynamically to obfuscate from Turbopack static analysis
    const agentDirName = ["squirryfy", "content", "agent"].join("-");
    const cwd = path.join(/*turbopackIgnore: true*/ process.cwd(), agentDirName);
    
    const pythonBinRelative = [".venv", "bin", "python"].join("/");
    const pythonPath = path.join(cwd, pythonBinRelative);
    const scriptPath = path.join(cwd, "agent.py");

    if (!fs.existsSync(pythonPath)) {
      return NextResponse.json(
        { error: `Python virtualenv executable not found at ${pythonPath}` },
        { status: 500 }
      );
    }

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json(
        { error: `Agent script not found at ${scriptPath}` },
        { status: 500 }
      );
    }

    let runId: string | null = null;
    let signalId: string | null = null;
    try {
      const body = await request.json();
      runId = body?.runId || null;
      signalId = body?.signalId || null;
    } catch (e) {
      // Body might be empty or invalid JSON, ignore and default to null
    }

    const spawnArgs = ["agent.py"];
    if (signalId) {
      spawnArgs.push("--signal-id", signalId);
    } else if (runId) {
      spawnArgs.push("--run-id", runId);
    }

    // Spawn the agent run in the background
    const child = spawn(pythonPath, spawnArgs, {
      cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: "1",
        MCP_TRANSPORT: "stdio"
      },
      detached: true,
      stdio: "ignore"
    });

    child.unref();

    return NextResponse.json({
      success: true,
      message: "Instagram generation agent triggered successfully in the background"
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
