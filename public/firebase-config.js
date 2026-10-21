export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: "",
  adminEmail: ""
};

export const isFirebaseConfigured = Object.entries(firebaseConfig)
  .filter(([key]) => key !== "adminEmail")
  .every(([, value]) => Boolean(value)) && Boolean(firebaseConfig.adminEmail);
