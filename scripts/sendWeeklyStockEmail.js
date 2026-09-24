// scripts/sendWeeklyStockEmail.js
const SUPABASE_URL = "https://cuszxcwhyfgtvbbylrdx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1c3p4Y3doeWZndHZiYnlscmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDg2ODEsImV4cCI6MjEwNDg4NDY4MX0.JJdMg7_h_6szxPzZszcp7l0HOHazgVRX4z-LHsZHfxw";

async function run() {
  console.log("Démarrage de l'envoi de l'email automatique des stocks...");

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  // 1. Fetch drinks
  const drinksRes = await fetch(`${SUPABASE_URL}/rest/v1/drinks?select=*`, { headers });
  if (!drinksRes.ok) throw new Error("Erreur fetch drinks: " + await drinksRes.text());
  const allDrinks = await drinksRes.json();

  // 2. Fetch admins with stock management rights
  const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email&can_manage_stock=eq.true`, { headers });
  if (!profilesRes.ok) throw new Error("Erreur fetch profiles: " + await profilesRes.text());
  const managers = await profilesRes.json();

  let adminEmails = managers.map(m => m.email).filter(Boolean).join(',');
  if (!adminEmails) adminEmails = "billardclubromo41@gmail.com";

  allDrinks.sort((a, b) => a.name.localeCompare(b.name));
  let alertList = "";
  let globalStock = "";
  let hasAlerts = false;

  let alertsAtThreshold = [];
  let alertsBelowThreshold = [];

  allDrinks.forEach(d => {
    const stock = d.stock || 0;
    const threshold = d.alert_threshold || 0;
    const nomBoisson = d.name.padEnd(25, ' ');
    const icon = (stock <= threshold) ? '🚨' : '✅';
    
    globalStock += `${icon} ${nomBoisson} : ${stock}\n`;

    if (stock <= threshold) {
      hasAlerts = true;
      const line = `🚨 ${nomBoisson} : ${stock} (Seuil: ${threshold})\n`;
      if (stock === threshold) {
        alertsAtThreshold.push(line);
      } else {
        alertsBelowThreshold.push({ stock, line });
      }
    }
  });

  alertsBelowThreshold.sort((a, b) => a.stock - b.stock);
  alertList = alertsAtThreshold.join('') + alertsBelowThreshold.map(a => a.line).join('');

  if (!hasAlerts) alertList = "Aucune boisson en alerte.\n";

  // 3. Send email using EmailJS REST API
  const emailPayload = {
    service_id: "service_j1zneme",
    template_id: "template_08br43s",
    user_id: "eMrX8i7i3dlg3WN20",
    template_params: {
      article_nom: "Rapport Hebdomadaire (Dimanche) - 100% AUTOMATIQUE",
      alert_list: alertList,
      global_stock: globalStock,
      admin_emails: adminEmails
    }
  };

  console.log("Envoi via EmailJS REST API...");
  const emailRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost" },
    body: JSON.stringify(emailPayload)
  });

  if (!emailRes.ok) {
    throw new Error("Erreur lors de l'envoi de l'email: " + await emailRes.text());
  }

  console.log("Email envoyé avec succès !");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
