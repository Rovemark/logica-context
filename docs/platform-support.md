# Platform Support

Logica Context works with any AI coding assistant that supports MCP (Model Context Protocol).

## Supported Platforms

| Platform | Config Location | Status |
|----------|----------------|--------|
| Claude Code | `configs/claude-code/` | Full support (hooks + MCP) |
| Cursor | `configs/cursor/` | MCP + .mdc rules |
| Gemini CLI | `configs/gemini-cli/` | MCP + GEMINI.md |
| VS Code Copilot | `configs/vscode-copilot/` | MCP + instructions |
| Codex | `configs/codex/` | MCP + AGENTS.md |
| Kiro | `configs/kiro/` | MCP + KIRO.md |
| Zed | `configs/zed/` | MCP + AGENTS.md |
| OpenCode | `configs/opencode/` | MCP + AGENTS.md |

## Setup

Each platform has its own config directory with:
- MCP server configuration (mcp.json or equivalent)
- Platform-specific instructions (CLAUDE.md, GEMINI.md, etc.)
- Hooks configuration where supported

Copy the relevant config files to your project or global settings.
