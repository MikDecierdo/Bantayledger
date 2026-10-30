import "dotenv/config";
import type { Knex } from "knex";

const config: Knex.Config = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "bantayledger",
    password: process.env.DB_PASSWORD ?? "bantayledger",
    database: process.env.DB_NAME ?? "bantayledger",
    // Store and read timestamps as UTC; the app layer is responsible for
    // formatting to the caller's locale, never the database connection.
    timezone: "Z",
    decimalNumbers: false,
  },
  migrations: {
    directory: "./migrations",
    extension: "js",
    tableName: "knex_migrations",
  },
  pool: { min: 0, max: 10 },
};

export default config;
