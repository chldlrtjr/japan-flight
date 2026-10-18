import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBcgvd-zHOvpuWHO6PLT7QI5H8xLsRx4A0",
  authDomain: "japan-flight-768d7.firebaseapp.com",
  projectId: "japan-flight-768d7",
  storageBucket: "japan-flight-768d7.firebasestorage.app",
  messagingSenderId: "709158377412",
  appId: "1:709158377412:web:8d8fdaa42d772bb52cb691"
};

// Next.js 환경에서 중복 초기화 방지
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
