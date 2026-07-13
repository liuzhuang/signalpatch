#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const [migrationPath] = process.argv.slice(2);
if (!migrationPath) {
  throw new Error("Usage: validate-sql.mjs <migration.sql>");
}

const sql = (await readFile(migrationPath, "utf8")).toLowerCase();
const required = [
  "create schema if not exists signalpatch",
  "create table signalpatch.feedback",
  "create table signalpatch.problems",
  "create table signalpatch.automation_runs",
  "alter table signalpatch.feedback enable row level security",
  "alter table signalpatch.problems enable row level security",
  "alter table signalpatch.automation_runs enable row level security",
  "security definer",
  "set search_path = ''",
  "revoke execute on all functions in schema signalpatch",
  "grant execute on function signalpatch.submit_feedback",
  "grant execute on function signalpatch.get_repair_status",
];
const missing = required.filter((statement) => !sql.includes(statement));
const forbidden = [
  "create table public.feedback",
  "create table public.problems",
  "create table public.automation_runs",
  "grant all on all tables in schema signalpatch to anon",
];
const presentForbidden = forbidden.filter((statement) =>
  sql.includes(statement),
);
const valid = missing.length === 0 && presentForbidden.length === 0;
process.stdout.write(
  `${JSON.stringify({ valid, missing, forbidden: presentForbidden })}\n`,
);
if (!valid) {
  process.exitCode = 1;
}
