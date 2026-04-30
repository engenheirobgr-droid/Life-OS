const admin = require('firebase-admin');

let app = null;

function getFirebaseAdminApp() {
  if (app) return app;
  if (admin.apps.length) {
    app = admin.app();
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';
  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new Error('firebase_admin_env_missing');
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  app = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });
  return app;
}

function getFirestoreAdmin() {
  const firebaseApp = getFirebaseAdminApp();
  return admin.firestore(firebaseApp);
}

module.exports = { getFirestoreAdmin };
