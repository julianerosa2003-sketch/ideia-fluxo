// Camada de nuvem: login com Google (Firebase Auth) + ideias no Firestore.
// Dados ficam em users/{uid}/ideas/{ideaId}; as regras garantem que cada um só acessa os seus.
import { initializeApp } from './vendor/firebase/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut, onAuthStateChanged,
} from './vendor/firebase/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch,
  terminate, clearIndexedDbPersistence,
} from './vendor/firebase/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'pt-BR';

// Cache local persistente: funciona offline e sincroniza quando a conexão volta.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const ideasCol = (uid) => collection(db, 'users', uid, 'ideas');

export function watchAuth(callback) {
  getRedirectResult(auth).catch(() => {}); // conclui login feito via redirect
  return onAuthStateChanged(auth, callback);
}

export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // Popup bloqueado ou não suportado (alguns PWAs instalados) → tenta redirect
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-environment'].includes(e.code)) {
      return signInWithRedirect(auth, provider);
    }
    throw e;
  }
}

// Sai e apaga a cópia local do Firestore (importante em aparelho compartilhado).
export async function logout() {
  await signOut(auth);
  await terminate(db);
  await clearIndexedDbPersistence(db).catch(() => {});
}

export function watchIdeas(uid, onData, onError) {
  return onSnapshot(ideasCol(uid), (snap) => onData(snap.docs.map((d) => d.data())), onError);
}

// Escritas: a UI não espera a promise (offline ela só resolve quando sincronizar).
export const saveIdea = (uid, idea) => setDoc(doc(ideasCol(uid), idea.id), idea);
export const deleteIdea = (uid, id) => deleteDoc(doc(ideasCol(uid), id));

async function inBatches(items, apply) {
  for (let i = 0; i < items.length; i += 400) { // limite do Firestore: 500 operações/lote
    const batch = writeBatch(db);
    items.slice(i, i + 400).forEach((item) => apply(batch, item));
    await batch.commit();
  }
}
export const saveMany = (uid, ideas) => inBatches(ideas, (b, i) => b.set(doc(ideasCol(uid), i.id), i));
export const deleteMany = (uid, ids) => inBatches(ids, (b, id) => b.delete(doc(ideasCol(uid), id)));
