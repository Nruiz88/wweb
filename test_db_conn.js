const mysql = require("mysql2/promise");

const url = process.env.MARIADB_URL || "mysql://mariadb:Z6kla6HsbuTZJbyP8b4m6QUAfYgaYOzHNv4yDYQcYZax1QxKmzjQg3NhLsBQitBo@w3uymvdjpzxod6zqajtdkoom:3306/default";

async function test() {
  try {
    const pool = mysql.createPool({ uri: url, connectionLimit: 2 });
    const [rows] = await pool.execute("SELECT 1 as ok");
    console.log("DB OK:", rows);
    const [tables] = await pool.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'profiles'");
    console.log("profiles exists?", tables.length > 0 ? "YES" : "NO (CREATE TABLE profiles ...)");
    await pool.end();
  } catch (e) {
    console.error("DB ERROR:", e.message);
  }
}

test();
