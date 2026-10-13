// As duas informações abaixo são PÚBLICAS e vêm do painel do Supabase.
// Nunca coloque aqui a senha do banco nem uma chave secret/service_role.
const SUPABASE_URL = "https://fqgxqmviefwhyehcihls.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ksRq77MX_3jqYJhH2yss_g_Bh75ZVqq";

window.organizaClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
