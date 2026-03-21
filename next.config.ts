import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";
import { fileURLToPath } from "url";

/**
 * 與本檔同目錄 = 專案根目錄（避免上層目錄另有 package-lock / yarn.lock 時 Next 誤判 workspace root）
 * @see https://nextjs.org/docs/app/api-reference/next-config-js/turbopack#root-directory
 */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** 評估設定檔時先載入 .env*（與 Next 內建載入一致，利於本地路徑判斷） */
loadEnvConfig(projectRoot);

/** 明確寫入 env，確保客戶端 bundle 一定內嵌 NEXT_PUBLIC_*（避免誤判 workspace root 時讀不到） */
const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nodeModules = path.join(projectRoot, "node_modules");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** 鎖定本 repo 為根目錄，消除「multiple lockfiles」警告 */
  outputFileTracingRoot: projectRoot,
  /**
   * 家目錄另有 package-lock 時，Turbopack 會在錯誤目錄解析 @import "tailwindcss"。
   * 強制從本專案 node_modules 解析。
   */
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      tailwindcss: path.join(nodeModules, "tailwindcss"),
    },
  },
  ...(publicSupabaseUrl && publicSupabaseAnonKey
    ? {
        env: {
          NEXT_PUBLIC_SUPABASE_URL: publicSupabaseUrl,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseAnonKey,
        },
      }
    : {}),
};

export default withPWA(nextConfig);
