/* Configuration de la version web. La clé « anon » de Supabase est publique
   par conception : les données sont protégées par la connexion et les règles
   RLS (supabase/schema.sql). Vide = mode « cet appareil uniquement ». */
window.LAMIA_WEB_CONFIG = {
  version: '0.2.0',
  supabaseUrl: '',
  supabaseAnonKey: ''
};
