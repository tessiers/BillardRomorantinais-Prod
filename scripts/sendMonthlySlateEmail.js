// scripts/sendMonthlySlateEmail.js
const SUPABASE_URL = "https://cuszxcwhyfgtvbbylrdx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1c3p4Y3doeWZndHZiYnlscmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMDg2ODEsImV4cCI6MjEwNDg4NDY4MX0.JJdMg7_h_6szxPzZszcp7l0HOHazgVRX4z-LHsZHfxw";

async function run() {
  console.log("Démarrage de l'envoi du rapport mensuel des ardoises...");

  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };

  // 1. Fetch unpaid consumptions with profiles and drinks data
  const consRes = await fetch(`${SUPABASE_URL}/rest/v1/consumptions?select=*,profiles(full_name,email),drinks(name)&is_paid=eq.false`, { headers });
  if (!consRes.ok) throw new Error("Erreur fetch consumptions: " + await consRes.text());
  const unpaidCons = await consRes.json();

  // 2. Fetch admins for the admin_emails field
  const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=email,role`, { headers });
  if (!profilesRes.ok) throw new Error("Erreur fetch profiles: " + await profilesRes.text());
  const profiles = await profilesRes.json();
  
  const admins = profiles.filter(p => p.role === 'admin' || p.email === 'sebastien.tessier41@orange.fr');
  let adminEmails = admins.map(m => m.email).filter(Boolean).join(',');
  if (!adminEmails) adminEmails = "billardclubromo41@gmail.com";

  // 3. Process unpaid consumptions to compute balance per member
  const memberData = {};
  let totalGlobal = 0;

  unpaidCons.forEach(c => {
    const memberName = c.profiles?.full_name || "Inconnu";
    const memberEmail = c.profiles?.email || null;
    const qty = c.quantity || 1;
    const price = c.price_at_time || 0;
    const amount = qty * price;

    if (amount > 0) {
        if (!memberData[memberName]) {
            memberData[memberName] = { balance: 0, email: memberEmail };
        }
        memberData[memberName].balance += amount;
        totalGlobal += amount;
    }
  });

  const memberNames = Object.keys(memberData).sort((a, b) => a.localeCompare(b));
  
  let alertList = "";
  let hasAlerts = false;

  memberNames.forEach(name => {
    const balance = memberData[name].balance;
    hasAlerts = true;
    const nomMembre = name.padEnd(25, ' ');
    alertList += `🚨 ${nomMembre} : ${balance.toFixed(2)} €\n`;
  });

  if (!hasAlerts) {
      alertList = "✅ Aucune ardoise en attente. Tout le monde est à jour !\n";
  }

  const globalStock = `Total global des ardoises : ${totalGlobal.toFixed(2)} €\n`;

  // 4. Send the global report email to admins
  const adminPayload = {
    service_id: "service_j1zneme",
    template_id: "template_6azzu2l",
    user_id: "eMrX8i7i3dlg3WN20",
    template_params: {
      article_nom: "Rapport Mensuel des Ardoises (27 du mois) - 100% AUTOMATIQUE",
      alert_list: alertList,
      global_stock: globalStock,
      admin_emails: adminEmails
    }
  };

  console.log("Envoi du rapport global aux administrateurs via EmailJS...");
  const adminRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost" },
    body: JSON.stringify(adminPayload)
  });

  if (!adminRes.ok) {
    console.error("Erreur lors de l'envoi du rapport global: " + await adminRes.text());
  } else {
    console.log("Rapport global envoyé avec succès !");
  }

  // 5. Send individual emails to members
  console.log("Envoi des rappels individuels aux membres...");
  for (const name of memberNames) {
    const data = memberData[name];
    if (data.email && data.balance > 0) {
      const memberPayload = {
        service_id: "service_j1zneme",
        template_id: "template_6azzu2l",
        user_id: "eMrX8i7i3dlg3WN20",
        template_params: {
          article_nom: "Rappel : Votre ardoise au Billard Club Romorantinais",
          alert_list: `Bonjour ${name},\n\nSauf erreur de notre part, vous avez une ardoise en attente de règlement d'un montant de ${data.balance.toFixed(2)} €.\nMerci de penser à la régler lors de votre prochain passage au club ou avant la fin du mois pour faciliter notre gestion comptable.\n\nSportivement,\nL'équipe du Billard Club.`,
          global_stock: "", // Left empty for the member email
          admin_emails: data.email
        }
      };

      try {
        const memberRes = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Origin": "http://localhost" },
          body: JSON.stringify(memberPayload)
        });
        
        if (!memberRes.ok) {
           console.error(`Erreur d'envoi pour ${name} (${data.email}): ` + await memberRes.text());
        } else {
           console.log(`Rappel envoyé avec succès à ${name} (${data.email})`);
        }
      } catch (err) {
        console.error(`Exception lors de l'envoi pour ${name}:`, err);
      }
      
      // Petite pause pour éviter de saturer l'API EmailJS
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log("Terminé !");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
