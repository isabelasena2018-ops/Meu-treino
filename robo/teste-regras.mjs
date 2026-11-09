/* Testa as regras do banco com usuários anônimos de verdade e limpa tudo no fim */
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection } from 'firebase/firestore';
import admin from 'firebase-admin';

const cfg = { apiKey: "AIzaSyDcOpgpCzrc2-e8KBSJuKTI7XyhnP7axSU", authDomain: "meu-treino-79191.firebaseapp.com", projectId: "meu-treino-79191", appId: "1:498314536315:web:e9c15b49d502098ac949de" };
async function user(name) { const app = initializeApp(cfg, name); const a = getAuth(app); await signInAnonymously(a); return { db: getFirestore(app), uid: a.currentUser.uid, app }; }
let ok = 0, falhas = 0;
async function deve(nome, permitido, fn) {
  try { await fn(); if (permitido) { ok++; console.log('OK   ', nome); } else { falhas++; console.log('FALHA (deixou e não devia)', nome); } }
  catch (e) { if (!permitido && /permission/i.test(e.code || e.message)) { ok++; console.log('OK   ', nome, '(bloqueado)'); } else { falhas++; console.log('FALHA', nome, e.code || e.message); } }
}
const A = await user('a'), B = await user('b');
const g = 'TESTE' + Date.now().toString(36).toUpperCase();
await deve('criar grupo', true, () => setDoc(doc(A.db, 'groups', g), { name: 'Teste regras', createdBy: A.uid, createdAt: Date.now() }));
await deve('A entra no grupo', true, () => setDoc(doc(A.db, 'groups', g, 'members', A.uid), { name: 'Ana', emoji: '💪', streak: 2, week: 3, lastActive: '2026-11-09', ts: Date.now() }, { merge: true }));
await deve('B entra no grupo', true, () => setDoc(doc(B.db, 'groups', g, 'members', B.uid), { name: 'Bia', emoji: '🦋', ts: Date.now() }, { merge: true }));
const pid = A.uid + '_2026-11-09';
await deve('A publica o dia', true, () => setDoc(doc(A.db, 'groups', g, 'posts', pid), { uid: A.uid, name: 'Ana', emoji: '💪', date: '2026-11-09', ts: Date.now(), acts: [{ t: 'musculacao', n: 'Glúteo', m: 60 }], streak: 2, week: 3, rotina: { creatina: true, agua: 2000, meta: 3000, ml: 1 }, comida: 'bem' }, { merge: true }));
await deve('A atualiza o dia (merge)', true, () => setDoc(doc(A.db, 'groups', g, 'posts', pid), { uid: A.uid, name: 'Ana', emoji: '💪', date: '2026-11-09', ts: Date.now(), streak: 3 }, { merge: true }));
await deve('B lê o feed', true, () => getDocs(collection(B.db, 'groups', g, 'posts')));
await deve('B reage com 🔥', true, () => updateDoc(doc(B.db, 'groups', g, 'posts', pid), { ['reactions.' + B.uid]: '🔥' }));
await deve('B tira a reação', true, async () => { const { deleteField } = await import('firebase/firestore'); await updateDoc(doc(B.db, 'groups', g, 'posts', pid), { ['reactions.' + B.uid]: deleteField() }); });
await deve('B reage com código estranho', false, () => updateDoc(doc(B.db, 'groups', g, 'posts', pid), { ['reactions.' + B.uid]: '<img src=x onerror=alert(1)>' }));
await deve('B mexe na reação de outra pessoa', false, () => updateDoc(doc(B.db, 'groups', g, 'posts', pid), { ['reactions.' + A.uid]: '🔥' }));
await deve('B muda o texto do post da A', false, () => updateDoc(doc(B.db, 'groups', g, 'posts', pid), { name: 'hackeado' }));
await deve('A publica campo estranho', false, () => setDoc(doc(A.db, 'groups', g, 'posts', A.uid + '_x'), { uid: A.uid, name: 'Ana', script: 'x' }));
await deve('A sai do grupo (apaga o post e o membro)', true, async () => { await deleteDoc(doc(A.db, 'groups', g, 'posts', pid)); });
await deve('push: A grava o próprio', true, () => setDoc(doc(A.db, 'push', A.uid), { teste: true }, { merge: true }));
await deve('users: A grava o próprio', true, () => setDoc(doc(A.db, 'users', A.uid), { name: 'Ana', lastSeen: Date.now() }, { merge: true }));
await deve('users: B não lista', false, () => getDocs(collection(B.db, 'users')));
const bid = 'teste' + Date.now().toString(36) + 'abcdefghijk';
await deve('backup: A cria', true, () => setDoc(doc(A.db, 'backups', bid), { owner: A.uid, name: 'Ana', at: Date.now(), size: 10, salt: 'x', iter: 310000, iv: 'y', gz: true, data: 'abc', v: 1 }));
await deve('backup: A cria o índice', true, () => setDoc(doc(A.db, 'backupIndex', bid), { owner: A.uid, name: 'Ana', at: Date.now(), size: 10 }));
await deve('backup: B baixa pelo link', true, () => getDoc(doc(B.db, 'backups', bid)));
await deve('backup: B sobrescreve', false, () => setDoc(doc(B.db, 'backups', bid), { owner: B.uid, name: 'x', at: 1, size: 1, salt: 'x', iter: 1, iv: 'y', gz: true, data: 'z', v: 1 }));
await deve('backup: B lista todos', false, () => getDocs(collection(B.db, 'backups')));
await deve('backupIndex: B lista', false, () => getDocs(collection(B.db, 'backupIndex')));
await deve('backup: A apaga o próprio', true, async () => { await deleteDoc(doc(A.db, 'backups', bid)); await deleteDoc(doc(A.db, 'backupIndex', bid)); });
// limpeza com a conta de serviço
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const adb = admin.firestore();
await adb.recursiveDelete(adb.doc('groups/' + g));
for (const u of [A.uid, B.uid]) { await adb.doc('push/' + u).delete().catch(() => {}); await adb.doc('users/' + u).delete().catch(() => {}); }
console.log(`\nResultado: ${ok} ok, ${falhas} falhas`);
await Promise.all([deleteApp(A.app), deleteApp(B.app)]);
process.exit(falhas ? 1 : 0);
