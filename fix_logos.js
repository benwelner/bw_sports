const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '_db');

// 1. Replaces the old GitHub absolute path with the new relative path
const OLD_URL_PATTERN = /https:\/\/raw\.githubusercontent\.com\/benwelner\/bw_sports\/main\/src\/app\/_images\/logos\/(.*?\.png|.*?\.jpg|.*?\.jpeg|.*?\.svg|.*?\.webp)/g;

// 2. FIXED: Extracts ANY URL from markdown [text](url) and keeps just the URL
const MARKDOWN_PATTERN = /\[.*?\]\((.*?)\)/g;

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip Markdown-wrapped URLs
  let updatedContent = content.replace(MARKDOWN_PATTERN, '$1');

  // Replace old URL with new relative path
  updatedContent = updatedContent.replace(OLD_URL_PATTERN, '/logos/$1');

  if (content !== updatedContent) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`✅ Cleaned: ${filePath}`);
  }
}

function walkDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.json')) {
      processFile(fullPath);
    }
  });
}

console.log("🚀 Starting logo path cleanup...");
walkDir(DB_DIR);
console.log("✨ Cleanup complete.");