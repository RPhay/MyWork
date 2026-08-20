import mssql from "mssql";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { encrypt } from "../src/utils/credentialCrypto.js";
import config from "../src/config/environment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, "../data/active-context.json");

const pool = await mssql.connect({
  server: config.database.host,
  port: config.database.port || 1433,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  options: { encrypt: true, trustServerCertificate: false },
});

const result = await pool
  .request()
  .query(
    "SELECT TOP 1 id, name FROM [MyWork].[contexts] ORDER BY order_index ASC, id ASC",
  );
await pool.close();

const ctx = result.recordset[0];
if (!ctx) {
  console.error("No contexts found in MSSQL");
  process.exit(1);
}

console.log(`First context: id=${ctx.id} name="${ctx.name}"`);

const store = {
  activeContextId: ctx.id,
  lastLiveConfig: {
    type: "mssql",
    host: config.database.host,
    port: config.database.port || 1433,
    database: config.database.name,
    user: config.database.user,
    passwordEnc: config.database.password
      ? encrypt(config.database.password)
      : null,
  },
};

fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
console.log("Updated data/active-context.json → restart the server to apply.");
