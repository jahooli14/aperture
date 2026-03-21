/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_GEMINI_API_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css' {
  const content: Record<string, string>
  export default content
}
