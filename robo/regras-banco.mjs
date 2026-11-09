/* Mostra ou publica as regras de segurança do banco (Firestore) usando a conta de serviço do GitHub */
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

if (!process.env.FIREBASE_SA) { console.log('Falta o segredo FIREBASE_SA.'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const rules = admin.securityRules();
const acao = process.env.ACAO || 'mostrar';

const atual = await rules.getFirestoreRuleset();
console.log('===== REGRAS ATUAIS (' + atual.name + ') =====');
console.log(atual.source.map(f => f.content).join('\n'));
console.log('===== FIM =====');

if (acao === 'publicar') {
  const src = readFileSync('../firestore.rules', 'utf8');
  const novo = await rules.releaseFirestoreRulesetFromSource(src);
  console.log('Regras novas publicadas: ' + novo.name);
}
