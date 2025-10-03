import admin from 'firebase-admin';
import serviceAccount from './velocall-32a42-firebase-adminsdk-fbsvc-93249679a5.json';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function testFirestore() {
  try {
    const docRef = db.collection('test').doc('hello');
    await docRef.set({ message: 'ok' });
    console.log('Firestore write success');
  } catch (err) {
    console.error('Firestore error:', err);
  }
}

testFirestore();
