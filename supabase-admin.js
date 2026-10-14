const supabaseUrl = "https://obnpotxehcktfdcseocz.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnBvdHhlaGNrdGZkY3Nlb2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjU4NTQsImV4cCI6MjA5Njk0MTg1NH0.ewsB-9T3j1V2BlhaDai9OpIAbPWK6NDQpvPf5SRNFfA";
window.supabaseClient = window.supabaseClient ||
    window.supabase.createClient(supabaseUrl, supabaseKey);