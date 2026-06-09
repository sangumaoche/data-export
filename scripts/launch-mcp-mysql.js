/**
 * MCP MySQL Server 启动脚本
 * 从 .env 加载环境变量，然后启动 mcp-server-mysql
 * 无外部依赖，仅使用 Node.js 内置模块
 */
const fs = require('fs');
const path = require('path');

// 解析 .env 文件并设置环境变量
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key) process.env[key] = value;
  }
} else {
  console.error(`[launch-mcp-mysql] .env file not found: ${envPath}`);
  process.exit(1);
}

// 启动 MCP Server
const serverHome = process.env.MCP_SERVER_HOME;
if (!serverHome) {
  console.error('[launch-mcp-mysql] MCP_SERVER_HOME not set in .env');
  process.exit(1);
}

const entryFile = path.join(serverHome, 'dist', 'index.js');
if (!fs.existsSync(entryFile)) {
  console.error(`[launch-mcp-mysql] MCP server entry not found: ${entryFile}`);
  process.exit(1);
}

const { spawn } = require('child_process');

const child = spawn(process.execPath, [entryFile], {
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
