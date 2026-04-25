const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.');

if (versionParts.length >= 1) {
    let lastPartIndex = versionParts.length - 1;
    let lastPartStr = versionParts[lastPartIndex];
    let lastPart = parseInt(lastPartStr);
    
    if (isNaN(lastPart)) {
        // Pokud to není číslo (např. "1.03-beta"), prostě přidáme .1
        versionParts.push("1");
    } else {
        let newLastPart = (lastPart + 1).toString();
        // Zachování paddingu (např. 03 -> 04)
        if (lastPartStr.length > newLastPart.length) {
            newLastPart = newLastPart.padStart(lastPartStr.length, '0');
        }
        versionParts[lastPartIndex] = newLastPart;
    }
} else {
    versionParts.push("1.00");
}

const newVersion = versionParts.join('.');
packageJson.version = newVersion;

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`Verze aktualizována: ${currentVersion} -> ${newVersion}`);
