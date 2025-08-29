const fs = require("fs");
const os = require("os");
const path = require("path");
const { env } = require("process");

// Dapatkan IP lokal
const interfaces = os.networkInterfaces();
let localIp = "127.0.0.1";

for (const name of Object.keys(interfaces)) {
  for (const iface of interfaces[name]) {
    if (iface.family === "IPv4" && !iface.internal) {
      localIp = iface.address;
      break;
    }
  }
}

const envPath = path.join(__dirname, ".env");

// Baca isi .env
let envContent = "";
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8");
}

// Fungsi set/update baris tertentu
function setEnvValue(content, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const newLine = `${key}=${value}`;
  if (content.match(pattern)) {
    return content.replace(pattern, newLine);
  } else {
    return content + `\n${newLine}`;
  }
}

// Update variabel di .env
envContent = setEnvValue(envContent, "NEXT_PUBLIC_USER_SERVER_URI", `http://${localIp}:4001/graphql`);
envContent = setEnvValue(envContent, "NEXT_PUBLIC_SURVEYACT_SERVER_URI", `http://${localIp}:4002/graphql`);
envContent = setEnvValue(envContent, "NEXT_PUBLIC_API_URL", `http://${localIp}:4002`);

// Simpan ulang ke .env
fs.writeFileSync(envPath, envContent.trim() + "\n", "utf8");
console.log("✅ File .env berhasil diperbarui dengan IP:", localIp);
