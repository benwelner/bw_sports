const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '_db');

// ==========================================
// 1. YOUR EXTERNAL LOGO DICTIONARY
// ==========================================
// When the script tells you a team is missing a logo, 
// find the online URL and add it here.
const LOGO_MAP = {
    // Example entries based on your data:
    "ST. LOUIS CITY SC": "https://a.espncdn.com/i/teamlogos/soccer/500/17604.png",
    "LA GALAXY": "https://a.espncdn.com/i/teamlogos/soccer/500/189.png",
    "CHARLOTTE FC": "https://a.espncdn.com/i/teamlogos/soccer/500/21134.png"
    // Add more teams here...
};

// ==========================================
// 2. THE AUTOMATED PROCESSOR
// ==========================================
function processFiles() {
    const missingLogos = new Set();
    let filesUpdated = 0;

    function walkDir(dir) {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            
            if (fs.statSync(fullPath).isDirectory()) {
                walkDir(fullPath);
            } else if (fullPath.endsWith('.json')) {
                let content = fs.readFileSync(fullPath, 'utf8');
                let events = JSON.parse(content);
                let fileChanged = false;

                events.forEach(event => {
                    // Process Home Team
                    if (event.home_team && event.home_team !== 'TBD') {
                        // If logo is empty, or uses a local path (starts with /logos/)
                        if (!event.home_logo || !event.home_logo.startsWith('http')) {
                            if (LOGO_MAP[event.home_team]) {
                                event.home_logo = LOGO_MAP[event.home_team];
                                fileChanged = true;
                            } else {
                                missingLogos.add(event.home_team);
                            }
                        }
                    }

                    // Process Away Team
                    if (event.away_team && event.away_team !== 'TBD') {
                        if (!event.away_logo || !event.away_logo.startsWith('http')) {
                            if (LOGO_MAP[event.away_team]) {
                                event.away_logo = LOGO_MAP[event.away_team];
                                fileChanged = true;
                            } else {
                                missingLogos.add(event.away_team);
                            }
                        }
                    }
                });

                if (fileChanged) {
                    // Save the updated JSON back to the file
                    fs.writeFileSync(fullPath, JSON.stringify(events, null, 2), 'utf8');
                    console.log(`✅ Updated logos in: ${fullPath}`);
                    filesUpdated++;
                }
            }
        });
    }

    console.log("🚀 Scanning database for missing external logos...");
    walkDir(DB_DIR);

    console.log(`\n✨ Update Complete! Modified ${filesUpdated} files.`);
    
    // Output the exact lines the user needs to copy/paste into the map
    if (missingLogos.size > 0) {
        console.log("\n⚠️ The following teams are using local/empty logos. Find their URLs and add them to the LOGO_MAP at the top of this script:\n");
        const sortedMissing = Array.from(missingLogos).sort();
        sortedMissing.forEach(team => {
            console.log(`    "${team}": "",`);
        });
    } else {
        console.log("\n🎉 All teams are currently mapped to external URLs!");
    }
}
