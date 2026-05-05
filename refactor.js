const fs = require('fs');
const path = require('path');

const mapping = {
    // Components
    "EventsContext": "@/events/components/EventsContext",
    "ScenarioEventRunButtons": "@/events/components/ScenarioEventRunButtons",
    "EventSequencePanel": "@/events/components/EventSequencePanel",
    
    // Core / hooks
    "eventSequenceState": "@/events/core/eventSequenceState",
    "interactionEvents": "@/events/core/interactionEvents",
    "eventSequenceDiffUrls": "@/events/core/eventSequenceDiffUrls",
    "eventSequenceSolutionUrls": "@/events/core/eventSequenceSolutionUrls",
    "aggregateEventSequenceAccuracy": "@/events/core/aggregateEventSequenceAccuracy",
    "useAutoReplaySequence": "@/events/hooks/useAutoReplaySequence",
};

function isTargetFile(name) {
    return name.endsWith('.tsx') || name.endsWith('.ts') || name.endsWith('.mjs');
}

function processDirectory(directory) {
    const files = fs.readdirSync(directory);

    for (const file of files) {
        const fullPath = path.join(directory, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!['node_modules', '.next', '.git', 'test-results', 'exported-logs'].includes(file)) {
                processDirectory(fullPath);
            }
        } else if (isTargetFile(fullPath)) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            let modified = false;

            for (const [matchName, newAlias] of Object.entries(mapping)) {
                // Replace import/export ... from '.../match_name' or ".../match_name"
                // capturing the path part safely.
                const regex = new RegExp(`(from\\s+['"])[^'"]*\\/(${matchName})(['"])`, 'g');
                
                content = content.replace(regex, (match, prefix, name, suffix) => {
                    modified = true;
                    return prefix + newAlias + suffix;
                });
            }

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf-8');
                console.log(`Updated paths in ${fullPath}`);
            }
        }
    }
}

processDirectory('.');
