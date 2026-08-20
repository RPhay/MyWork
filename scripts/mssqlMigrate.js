import mssql from "mssql";
import { createMssqlSchema } from "../src/database/schema/mssqlSchema.js";
import config from "../src/config/environment.js";

const pool = await mssql.connect({
  server: config.database.host,
  port: config.database.port || 1433,
  user: config.database.user,
  password: config.database.password,
  database: config.database.name,
  options: { encrypt: true, trustServerCertificate: false },
});

console.log("Connected. Running MSSQL schema migration...");
await createMssqlSchema(pool);
await pool.close();
console.log("Done.");
