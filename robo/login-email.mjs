/* Mostra e (se pedido) liga o login por e-mail e senha no Firebase Authentication, usando a conta de serviço do GitHub.
   Não imprime nenhum segredo: só o estado dos provedores de login. */
import admin from 'firebase-admin';

if (!process.env.FIREBASE_SA) { console.log('Falta o segredo FIREBASE_SA.'); process.exit(1); }
const sa = JSON.parse(process.env.FIREBASE_SA);
const cred = admin.credential.cert(sa);
const { access_token } = await cred.getAccessToken();
const base = `https://identitytoolkit.googleapis.com/admin/v2/projects/${sa.project_id}/config`;
const H = { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' };

const mostrar = async (titulo) => {
  const r = await fetch(base, { headers: H });
  const j = await r.json();
  if (!r.ok) { console.log(titulo, '→ erro', r.status, JSON.stringify(j.error && { code: j.error.code, status: j.error.status, message: j.error.message })); return null; }
  const s = j.signIn || {};
  console.log(titulo, '→ anônimo:', !!(s.anonymous && s.anonymous.enabled), '| e-mail:', !!(s.email && s.email.enabled), '| exige senha:', !!(s.email && s.email.passwordRequired));
  return j;
};

await mostrar('Antes');
if ((process.env.ACAO || 'mostrar') === 'ligar') {
  const r = await fetch(base + '?updateMask=signIn.email.enabled,signIn.email.passwordRequired', {
    method: 'PATCH', headers: H, body: JSON.stringify({ signIn: { email: { enabled: true, passwordRequired: true } } })
  });
  const j = await r.json();
  if (!r.ok) { console.log('Não consegui ligar →', r.status, JSON.stringify(j.error && { code: j.error.code, status: j.error.status, message: j.error.message })); process.exit(1); }
  await mostrar('Depois');
}
