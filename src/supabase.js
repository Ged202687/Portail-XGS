import { createClient } from "@supabase/supabase-js";

// Meme projet Supabase qu'Auréo, Méridien, Mon salaire et Horizon : un agent
// n'a qu'un seul compte pour tous les outils.
export const SUPABASE_URL = "https://fipvndiueabrehsmqxth.supabase.co";
export const SUPABASE_KEY = "sb_publishable_aNR2zGeJS9UgYLnvsvtVaw_tItHLC10";
// Cle anonyme historique : c'est avec elle qu'Auréo appelle email_from_login
// avant la connexion. On garde le meme appel, pour le meme comportement.
const SUPABASE_ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcHZuZGl1ZWFicmVoc21xeHRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTA0MjUsImV4cCI6MjEwMjcyNjQyNX0.PTPShNDncsT793-fBMP-Ko2gk3trOGtuwWYQ3L450j8";

// La session est gardee sous la cle standard du client Supabase
// (sb-<projet>-auth-token). Tout outil servi a la meme adresse que le portail
// et qui utilise ce client la retrouve : c'est la connexion unique.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Les agents se connectent avec leur identifiant, pas leur email : la base
// donne l'email qui correspond.
export async function emailDepuisIdentifiant(identifiant) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/email_from_login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_ANON_JWT}` },
    body: JSON.stringify({ p_login: identifiant }),
  });
  if (!res.ok) throw new Error("Connexion impossible pour le moment. Réessayez dans un instant.");
  return res.json();
}
