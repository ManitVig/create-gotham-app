#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const TEMPLATE_REPO = 'https://github.com/ManitVig/GoTHAM-starter-app.git';

async function createProject(projectPath, goProjectIdentifier) {
  const projectDir = path.join(projectPath);
  // Check if directory exists
  if (fs.existsSync(projectDir)) {
    const { overwrite } = await inquirer.prompt({
      type: 'confirm',
      name: 'overwrite',
      message: `Directory '${projectDir}' already exists. Overwrite?`,
    });
    if (!overwrite) {
      console.error('Project creation cancelled.');
      return;
    }
    await fs.promises.rm(projectDir, { recursive: true });
  }

  console.log(`Cloning template repository: ${TEMPLATE_REPO}`);
  // Use shell commands for cloning (consider using a promise-based library for advanced handling)
  await new Promise((resolve, reject) => {
    const child = require('child_process').spawn('git', ['clone', TEMPLATE_REPO, projectDir]);
    child.stdout.on('data', (data) => console.log(data.toString()));
    child.stderr.on('data', (data) => console.error(data.toString()));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Git clone failed with exit code: ${code}`));
      }
    });
  });

  await fs.promises.rm(path.join(projectDir, '.git'), { recursive: true });

  await fs.promises.unlink(path.join(projectDir, '.gitignore'));

  console.log(`Initializing go.mod with identifier: ${goProjectIdentifier}`);
  await initializeGoMod(projectDir, goProjectIdentifier);

  // Modify Go imports (optional, adjust as needed)
  const replaceFrom = 'github.com/manitvig/gotham-starter-app';
  const replaceTo = `${goProjectIdentifier}`;

  await modifyGoImports(projectDir, replaceFrom, replaceTo);

  console.log(`Project '${goProjectIdentifier}' created successfully!`);
  console.log(`Navigate to the project directory: cd ${projectPath}`);
  console.log('Install go dependencies: templ generate && go mod tidy');
  console.log('Install js dependencies: npm install or bun install or yarn install or pnpm install');
}

async function initializeGoMod(projectDir, goProjectIdentifier) {
  const goModPath = path.join(projectDir, 'go.mod');
  try {
    await fs.promises.writeFile(goModPath, `module ${goProjectIdentifier}`, 'utf8');
    console.log('go.mod created successfully.');
  } catch (error) {
    console.error(`Error creating go.mod: ${error}`);
  }
}

async function modifyGoImports(projectDir, replaceFrom, replaceTo) {
  const processDirectory = async (dirPath) => {
    const files = await fs.promises.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      //console.log(`found file: ${filePath}`)
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        await processDirectory(filePath); // Recursively process subdirectories
      } else if (stats.isFile() && (filePath.endsWith('.go') || filePath.endsWith(".templ"))) {
        //console.log(`found file: ${filePath}`)
        let content = await fs.promises.readFile(filePath, 'utf8');
        const importRegex = new RegExp(`${replaceFrom}`, 'gm'); // Flexible import replacement regex
        content = content.replace(importRegex, (_match, _capturedGroup) => {
          //console.log(`replacing ${match} with ${replaceTo} in ${filePath}`)
          return `${replaceTo}`;
        });
        await fs.promises.writeFile(filePath, content, 'utf8');
      }
    }
  };

  await processDirectory(projectDir);
}

const args = process.argv.slice(2);
if (args.length !== 2) {
  console.error('Error: Please provide a project path and a Go project identifier as arguments.');
  process.exit(1);
}

const projectPath = args[0];
const goProjectIdentifier = args[1];
createProject(projectPath, goProjectIdentifier).catch((error) => {
  console.error(error);
  process.exit(1);
});
