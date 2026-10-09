/* Configuration de la version web. La clé « anon » de Supabase est publique
   par conception : les données sont protégées par la connexion et les règles
   RLS (supabase/schema.sql). Vide = mode « cet appareil uniquement ». */
window.LAMIA_WEB_CONFIG = {
  version: '0.2.0',
  supabaseUrl: 'https://aqkqacpmtxthlqncvote.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxa3FhY3BtdHh0aGxxbmN2b3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1Mjg2NzYsImV4cCI6MjEwNzEwNDY3Nn0._MOd8RyiwtrPNsfGx0yTsNchLz19Vn2SVadDQzt-SuE'
};
