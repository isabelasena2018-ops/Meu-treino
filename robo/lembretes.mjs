/* Robô de lembretes do Meu Treino: roda no GitHub a cada 30 min */
import admin from 'firebase-admin';
import webpush from 'web-push';
import { lembretesDevidos, montarNotificacao } from './regras.mjs';

const VAPID_PUBLIC = 'BBxIj2dVmCdc8ky50XrbQuqUX6oswFtc8zO6iRMQGFA-CeKrBZ0rRRz9Z9P19U3E-WkpngSbkgtQOZv6tP2EC3E';

if (!process.env.FIREBASE_SA || !process.env.VAPID_PRIVATE) {
  console.log('Faltam os segredos FIREBASE_SA e/ou VAPID_PRIVATE no GitHub. Nada a fazer.');
  process.exit(0);
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = admin.firestore();
webpush.setVapidDetails('https://isabelasena2018-ops.github.io/Meu-treino/', VAPID_PUBLIC, process.env.VAPID_PRIVATE.trim());

const agora = new Date();
const snap = await db.collection('push').get();
let enviados = 0;
for (const docSnap of snap.docs) {
  const doc = docSnap.data();
  const devidos = lembretesDevidos(doc, agora);
  if (!devidos.length) continue;
  const n = montarNotificacao(devidos);
  try {
    await webpush.sendNotification(doc.sub, JSON.stringify(n), { TTL: 3600, urgency: 'normal' });
    const upd = {};
    devidos.forEach(d => { upd['sent.' + d.chave] = d.dia; });
    await docSnap.ref.update(upd);
    enviados++;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await docSnap.ref.update({ sub: admin.firestore.FieldValue.delete() });   // celular desinstalou ou desativou
      console.log('Inscrição expirada removida:', docSnap.id);
    } else {
      console.log('Erro ao enviar para', docSnap.id, e.statusCode || '', e.body || e.message);
    }
  }
}
console.log(`Pessoas com notificação: ${snap.size}. Lembretes enviados: ${enviados}.`);
