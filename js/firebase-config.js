/*
  Configuración de Firebase para BogoVial.
*/

const firebaseConfig = {
  apiKey: "AIzaSyCO-ozLFGpubyh05EoA2bOMi7KoVi6Ux3k",
  authDomain: "infrayic-bogovial.firebaseapp.com",
  projectId: "infrayic-bogovial",
  storageBucket: "infrayic-bogovial.firebasestorage.app",
  messagingSenderId: "834911384379",
  appId: "1:834911384379:web:7376ac6ac8a10e115dbd1e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();