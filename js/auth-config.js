/*
 * Public Supabase settings for online accounts.
 *
 * Fill these in from Supabase Dashboard -> Project Settings -> API.
 * The anon / publishable key is designed to be public and is protected by Row
 * Level Security. Never put a service_role key in this file.
 *
 * siteUrl is optional. Leave it blank to use the current origin. Any URL that
 * confirmation or password-reset emails should return to must be allowed in
 * Authentication -> URL Configuration in Supabase.
 */
window.CUH_AUTH_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  siteUrl: ''
};
