/* ============================================================
   supabase.js — Supabase Backend Integration
   ============================================================ */

const SUPABASE_URL      = "https://ghdhorhusbqmveiebjdf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoZGhvcmh1c2JxbXZlaWViamRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODUwNDAsImV4cCI6MjA5MjA2MTA0MH0.g40nvr0xBNfiVCrD7W4nw5xtzEP6kU60GgcrD1WHK9g";

// Initialize the Supabase client using the global 'supabase' object provided by the CDN
// We name it supabaseClient to avoid conflicting with the CDN's global variable
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);