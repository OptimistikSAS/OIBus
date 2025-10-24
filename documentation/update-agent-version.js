const fs = require('fs');
const path = require('path');

async function updateVersion() {
  try {
    const repo = 'OptimistikSAS/OIBusAgentRelease';
    const docsDir = path.join(__dirname, 'build');

    // Fetch the latest release from GitHub API
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);

    if (!response.ok) {
      throw new Error(`Failed to fetch latest release: ${response.statusText}`);
    }

    const data = await response.json();

    const latestVersion = data.tag_name;

    console.info(`Latest OIBus Agent version: ${latestVersion}. Updating __VERSION__ in the documentation`);

    // Recursively process all Markdown files in the docs directory
    function updateFiles(dir) {
      fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);

        if (fs.statSync(filePath).isDirectory()) {
          updateFiles(filePath); // Recursively process subdirectories
        } else if (file.endsWith('.js') || file.endsWith('.html')) {
          let content = fs.readFileSync(filePath, 'utf-8');

          // Replace the placeholder with the latest version
          const updatedContent = content.replace(
            /https:\/\/github\.com\/OptimistikSAS\/OIBusAgentRelease\/releases\/latest\/download\/oibus-agent-(win_(x64|x86|arm64))-__VERSION__\.zip/g,
            `https://github.com/OptimistikSAS/OIBusAgentRelease/releases/download/${latestVersion}/oibus-agent-$1-${latestVersion}.zip`
          );

          // Write changes back to the file if content has been updated
          if (content !== updatedContent) {
            fs.writeFileSync(filePath, updatedContent, 'utf-8');
            console.log(`Updated: ${filePath}`);
          }
        }
      });
    }

    updateFiles(docsDir);

    console.info('OIBus Agent version placeholders updated successfully.');
  } catch (error) {
    console.error('Error fetching the latest version:', error.message);
    process.exit(1);
  }
}

updateVersion();
