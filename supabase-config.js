/* Replace these two values with your Supabase project details.
   Supabase Dashboard → Project Settings → API
   Use the Project URL and the Publishable/Anon key.
   NEVER put the service_role/secret key in this file. */

const SUPABASE_URL = "https://vnatmmwmetbdlysaauau.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_9QKBJBv0WGggYooQce62ZQ_FdYEzUZX";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);