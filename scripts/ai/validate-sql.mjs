#!/usr/bin/env node
// 【做什么】校验 Supabase 迁移是否包含 signalpatch 必需表/RLS/RPC，并拒绝 public 整库授权
// 【何时跑】pnpm verify（pnpm validate:sql）
import { readFile } from "node:fs/promises";

const [migrationPath] = process.argv.slice(2);
if (!migrationPath) {
  throw new Error("Usage: validate-sql.mjs <migration.sql>");
}

const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

////////////////////////////////////////////////////
// 确认最小领域表、RLS、安全函数和匿名 RPC 授权都存在于 signalpatch Schema
////////////////////////////////////////////////////
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

////////////////////////////////////////////////////
// 显式拒绝把业务表建到 public 或向匿名角色授予整库权限
////////////////////////////////////////////////////
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
