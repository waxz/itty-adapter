#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises'; // Built-in Node.js promises API

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function createProject() {
    try {
        // 1. Ask Questions
        const projectName = await rl.question('Project name (demo-my-itty-app): ') || 'demo-my-itty-app';
        const targetDir = await rl.question(`Destination path (default: ./${projectName}): `) || projectName;

        rl.close();

        // ... (previous readline code)

        const source = path.join(__dirname, '../my-itty-app');
        // Force 'dest' to be relative to the USER'S current terminal location
        const dest = path.resolve(process.cwd(), targetDir);

        try {
            // 1. Ensure source exists
            if (!fs.existsSync(source)) {
                throw new Error(`Source folder missing at ${source}`);
            }

            // 2. Create the destination directory first
            fs.mkdirSync(dest, { recursive: true });

            console.log(`🚀 Creating template project in ${dest}`);

            // 3. Copy
            fs.cpSync(source, dest, {
                recursive: true
            });

            console.log('✅ Template copied.');

            // 4. Install Dependencies with shell: true
            console.log('📦 Installing dependencies...');
            execSync('npm install', {
                stdio: 'inherit',
                cwd: dest,
                shell: true // <--- Crucial fix for ENOENT errors
            });

        } catch (err) {
            console.error('❌ Failed:', err.message);
            process.exit(1);
        }



    } catch (err) {
        console.error('❌ Failed to create project:', err.message);
        process.exit(1);
    }

}

createProject();
