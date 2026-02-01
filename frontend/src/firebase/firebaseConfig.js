// Firebase configuration for Chat App
// This file contains the Firebase Web SDK configuration

const firebaseConfig = {
    apiKey: "AIzaSyCaMvYaskytQBLmHMzSyPxiJtGEGgZc4x4",
    authDomain: "chat-web-app-2cd3e.firebaseapp.com",
    projectId: "chat-web-app-2cd3e",
    storageBucket: "chat-web-app-2cd3e.firebasestorage.app",
    messagingSenderId: "377240953089",
    appId: "1:377240953089:web:142040ea34019403fa7b00",
    measurementId: "G-756Q7EW91H"
};

// VAPID key for Web Push notifications
// Get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
export const vapidKey = "BARh4pyUvrxOp981UHuolepPmnwom650RxlRISd0NhtuLqnz8d5MiH_ugFmRlf9bM-IudfrCIAgJo1-8zOuFRzg";

export default firebaseConfig;
