export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
  adminUid: ""
};

export const isFirebaseConfigured = Object.entries(firebaseConfig)
  .filter(([key]) => key !== "adminUid")
  .every(([, value]) => Boolean(value)) && Boolean(firebaseConfig.adminUid);
