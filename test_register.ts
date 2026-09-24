import mysql from "mysql2/promise";

const pool = mysql.createPool({
  uri: process.env.MARIADB_URL || "mysql://mariadb:BXjbq9w2mwTel6ANoMTwH975nJS2q6n6yVQgHrm6NKTFRm5wdRf3VtROrbikOWTa@w3uymvdjpzxod6zqajtdkoom:3306/default",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

async function test() {
  try {
    const [rows] = await pool.execute("SELECT id FROM profiles WHERE email = ?", ["prueba@test.com"]);
    console.log("query result:", Array.isArray(rows), rows?.length, rows);
  } catch (e: any) {
    console.error("query error:", e.message);
  }
}

test();
