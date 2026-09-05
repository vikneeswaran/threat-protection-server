import fs from "fs";
import path from "path";

const files = [
  path.join(process.cwd(), "public/tray/templates/install-helper.ps1"),
  path.join(process.cwd(), "public/tray/templates/uninstall-kuamini-windows.ps1"),
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    throw new Error(`Missing template: ${f}`);
  }
  const c = fs.readFileSync(f, "utf8");
  if (c.length < 3000) {
    throw new Error(`Template too small/corrupt: ${f} (${c.length} chars)`);
  }
  if (!c.includes("try") || !c.includes("catch")) {
    throw new Error(`Template likely malformed (missing try/catch): ${f}`);
  }
}

console.info("Windows helper templates validation passed.");