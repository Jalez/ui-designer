import Database from "better-sqlite3";
import path from "path";

const dbPath = path.join(process.cwd(), "db", "ui_designer_dev.sqlite");
const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

export default db;
