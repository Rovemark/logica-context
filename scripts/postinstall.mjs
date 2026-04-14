#!/usr/bin/env node
// scripts/postinstall.mjs — Auto-setup on npm install
// Creates .logica-context directory and verifies dependencies

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const dataDir = join(homedir(), '.logica-context');

try {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log('Logica Context: Created data directory at', dataDir);
  }

  // Write default config
  const configPath = join(dataDir, 'config.json');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({
      version: '1.0.0',
      supabase_enabled: false,
      max_output_size: 50000,
      exec_timeout: 30000,
      auto_index: true,
    }, null, 2));
    console.log('Logica Context: Default config created');
  }

  console.log('Logica Context: Ready. Add to .mcp.json:');
  console.log('  { "logica-context": { "type": "stdio", "command": "npx", "args": ["-y", "logica-context"] } }');
} catch (err) {
  // Silent — postinstall should never break npm install
}
