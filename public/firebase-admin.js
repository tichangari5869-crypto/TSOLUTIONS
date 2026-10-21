import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const adminSheet = document.querySelector("#admin-sheet");
const adminStatus = document.querySelector("#admin-status");
const adminEditor = document.querySelector("#admin-editor");
const adminAccount = document.querySelector("#admin-account");
const adminLoginForm = document.querySelector("#admin-login-form");
const signInButton = document.querySelector("#admin-sign-in");
const signOutButton = document.querySelector("#admin-sign-out");
const categorySelect = document.querySelector("#admin-category");
const serviceSelect = document.querySelector("#admin-service");
const catalogRefPath = ["site", "catalog"];
const version = "12.4.0";

let categories = [];
let siteSettings = { ...window.tSolutionsSettings };
let auth;
let database;
let firestore;
let initialized = false;
let activeCategoryIndex = 0;
let activeServiceIndex = 0;
let authSdk;
let verificationPromptSent = false;

const status = (message, isError = false) => {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("error", isError);
};

function closeAdmin() {
  adminSheet.classList.remove("open");
  adminSheet.setAttribute("aria-hidden", "true");
}

function openAdmin() {
  adminSheet.classList.add("open");
  adminSheet.setAttribute("aria-hidden", "false");
  if (!isFirebaseConfigured) {
    status("Admin sign-in is not configured yet. Complete the Firebase project and admin account setup in the deployment instructions.", true);
  } else if (!initialized) {
    initializeFirebase().catch((error) => {
      console.error("Firebase admin setup failed.", error);
      status("Admin sign-in could not connect to Firebase. Check the Firebase setup and try again.", true);
    });
  }
  signInButton.focus();
}

function currentService() {
  return categories[activeCategoryIndex]?.items[activeServiceIndex];
}

function markDraft() {
  status("Unpublished changes. Publish changes to make them live on the website.");
}

function renderServiceOptions(preferredIndex = activeServiceIndex) {
  const category = categories[activeCategoryIndex];
  const items = category?.items || [];
  serviceSelect.replaceChildren(...items.map((item, index) =>
    new Option(`${index + 1}. ${item.n}`, String(index))
  ));
  if (items.length) {
    const index = Math.min(Number(preferredIndex) || 0, items.length - 1);
    activeServiceIndex = index;
    serviceSelect.value = String(index);
    fillServiceForm();
  } else {
    activeServiceIndex = -1;
    serviceSelect.value = "";
    clearServiceForm();
  }
}

function fillServiceForm() {
  const service = currentService();
  if (!service) return clearServiceForm();
  document.querySelector("#admin-name").value = service.n || "";
  document.querySelector("#admin-low").value = Number(service.lo) || 0;
  document.querySelector("#admin-high").value = Number(service.hi) || 0;
  document.querySelector("#admin-time").value = service.t || "";
  document.querySelector("#admin-delivery").value = service.d || "";
  document.querySelector("#admin-bring").value = (service.b || []).join("\n");
  document.querySelector("#admin-ask").value = (service.ask || []).join("\n");
  document.querySelector("#admin-per-page").checked = Boolean(service.per);
}

function clearServiceForm() {
  for (const id of ["admin-name", "admin-low", "admin-high", "admin-time", "admin-delivery", "admin-bring", "admin-ask"]) {
    document.querySelector(`#${id}`).value = "";
  }
  document.querySelector("#admin-per-page").checked = false;
}

function renderCategories(preferredIndex = activeCategoryIndex) {
  categorySelect.replaceChildren(...categories.map((category, index) =>
    new Option(category.n, String(index))
  ));
  if (categories.length) {
    const index = Math.min(Number(preferredIndex) || 0, categories.length - 1);
    activeCategoryIndex = index;
    categorySelect.value = String(index);
    document.querySelector("#admin-category-name").value = categories[index].n;
  } else {
    activeCategoryIndex = -1;
    categorySelect.value = "";
    document.querySelector("#admin-category-name").value = "";
  }
  activeServiceIndex = 0;
  renderServiceOptions();
}

function validateService(service) {
  return service.n.trim() && service.t.trim() && service.d.trim() &&
    Number.isFinite(service.lo) && service.lo >= 0 &&
    Number.isFinite(service.hi) && service.hi >= service.lo &&
    service.b.length > 0 && Array.isArray(service.ask);
}

function syncCurrentService() {
  const service = currentService();
  if (!service) return;
  service.n = document.querySelector("#admin-name").value.trim();
  service.lo = Number(document.querySelector("#admin-low").value);
  service.hi = Number(document.querySelector("#admin-high").value);
  service.per = document.querySelector("#admin-per-page").checked ? 1 : 0;
  service.t = document.querySelector("#admin-time").value.trim();
  service.d = document.querySelector("#admin-delivery").value.trim();
  service.b = document.querySelector("#admin-bring").value.split("\n").map((value) => value.trim()).filter(Boolean);
  service.ask = document.querySelector("#admin-ask").value.split("\n").map((value) => value.trim()).filter(Boolean);
}

function syncSiteSettings() {
  siteSettings = {
    brand: document.querySelector("#admin-brand").value.trim(),
    headline: document.querySelector("#admin-headline").value.trim(),
    intro: document.querySelector("#admin-intro").value.trim(),
    description: document.querySelector("#admin-description").value.trim(),
    whatsapp: document.querySelector("#admin-whatsapp").value.trim().replace(/[\s+()-]/g, ""),
    searchPlaceholder: document.querySelector("#admin-search-placeholder").value.trim(),
    pills: document.querySelector("#admin-pills").value.split("\n").map((value) => value.trim()).filter(Boolean),
    howTitle: document.querySelector("#admin-how-title").value.trim(),
    steps: document.querySelector("#admin-steps").value.split("\n").map((value) => value.trim()).filter(Boolean),
    searches: document.querySelector("#admin-searches").value.split("\n").map((value) => value.trim()).filter(Boolean),
    footerCopy: document.querySelector("#admin-footer-copy").value.trim()
  };
}

function fillSiteSettings() {
  document.querySelector("#admin-brand").value = siteSettings.brand;
  document.querySelector("#admin-headline").value = siteSettings.headline;
  document.querySelector("#admin-intro").value = siteSettings.intro;
  document.querySelector("#admin-description").value = siteSettings.description;
  document.querySelector("#admin-whatsapp").value = siteSettings.whatsapp;
  document.querySelector("#admin-search-placeholder").value = siteSettings.searchPlaceholder;
  document.querySelector("#admin-pills").value = siteSettings.pills.join("\n");
  document.querySelector("#admin-how-title").value = siteSettings.howTitle;
  document.querySelector("#admin-steps").value = siteSettings.steps.join("\n");
  document.querySelector("#admin-searches").value = siteSettings.searches.join("\n");
  document.querySelector("#admin-footer-copy").value = siteSettings.footerCopy;
}

function validSiteSettings(settings) {
  return settings.brand && settings.headline && settings.intro && settings.description && settings.searchPlaceholder &&
    /^254\d{9}$/.test(settings.whatsapp) && settings.pills.length > 0 &&
    settings.howTitle && settings.steps.length > 0 && settings.searches.length > 0;
}

function validCatalog(catalog) {
  return catalog.length > 0 && catalog.every((category) =>
    category.n && Array.isArray(category.items) &&
    category.items.every((service) => validateService(service))
  );
}

async function publishChanges() {
  syncCurrentService();
  if (activeCategoryIndex >= 0) {
    categories[activeCategoryIndex].n = document.querySelector("#admin-category-name").value.trim();
  }
  syncSiteSettings();

  if (!validCatalog(categories)) {
    status("Complete every category and service before publishing. Services need a name, valid prices, time, delivery, and at least one item to bring.", true);
    return;
  }
  if (!validSiteSettings(siteSettings)) {
    status("Complete the website text, valid 254 phone number, at least one feature, one step, and one search shortcut before publishing.", true);
    return;
  }

  try {
    await firestore.setDoc(firestore.doc(database, ...catalogRefPath), { categories, settings: siteSettings });
    window.dispatchEvent(new CustomEvent("service-catalog-loaded", { detail: categories }));
    window.dispatchEvent(new CustomEvent("site-settings-loaded", { detail: siteSettings }));
    renderCategories(activeCategoryIndex);
    fillSiteSettings();
    status("Published. Your changes are now live on the website.");
  } catch (error) {
    console.error("Unable to publish the website changes.", error);
    status("Could not publish changes. Check your Firestore security rules and connection, then try again.", true);
  }
}

async function loadCatalog() {
  try {
    const snapshot = await firestore.getDoc(firestore.doc(database, ...catalogRefPath));
    if (!snapshot.exists()) return;
    const data = snapshot.data();
    const savedCategories = data.categories;
    if (!Array.isArray(savedCategories) || savedCategories.some((category) =>
      !category || typeof category.n !== "string" || !Array.isArray(category.items) ||
      category.items.some((item) => !item || typeof item.n !== "string" ||
        !Array.isArray(item.b) || !Array.isArray(item.ask))
    )) {
      throw new Error("Stored catalog has an invalid format.");
    }
    categories = savedCategories;
    window.dispatchEvent(new CustomEvent("service-catalog-loaded", { detail: categories }));
    if (data.settings && typeof data.settings === "object") {
      siteSettings = { ...siteSettings, ...data.settings };
      window.dispatchEvent(new CustomEvent("site-settings-loaded", { detail: siteSettings }));
    }
    if (auth.currentUser?.uid === firebaseConfig.adminUid) {
      renderCategories();
      fillSiteSettings();
    }
  } catch (error) {
    console.error("Unable to load the saved service catalog.", error);
    status("Could not load saved services. The public catalog is still available; check Firestore access.", true);
  }
}

window.addEventListener("service-catalog-loaded", (event) => {
  if (!Array.isArray(event.detail)) return;
  categories = JSON.parse(JSON.stringify(event.detail));
  if (adminEditor.hidden) return;
  renderCategories();
});
window.addEventListener("site-settings-loaded", (event) => {
  if (!event.detail || typeof event.detail !== "object") return;
  siteSettings = { ...siteSettings, ...event.detail };
  if (!adminEditor.hidden) fillSiteSettings();
});

async function initializeFirebase() {
  if (initialized) return;
  status("Connecting to Firebase…");
  const [appSdk, authModule, firestoreSdk] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
  ]);
  const app = appSdk.initializeApp(firebaseConfig);
  authSdk = authModule;
  auth = authSdk.getAuth(app);
  database = firestoreSdk.getFirestore(app);
  firestore = firestoreSdk;
  initialized = true;

  authSdk.onAuthStateChanged(auth, async (user) => {
    const userMatches = user?.uid === firebaseConfig.adminUid;
    const authorized = Boolean(userMatches && user.emailVerified);
    adminEditor.hidden = !authorized;
    adminAccount.hidden = !authorized;
    adminLoginForm.hidden = authorized;
    signOutButton.hidden = !authorized;
    if (userMatches && !user.emailVerified) {
      status("Verify the admin email address before signing in.", true);
      return;
    }
    if (user && !userMatches) {
      status("This account is not authorized to manage the site.", true);
      await authSdk.signOut(auth);
      return;
    }
    if (authorized) {
      status(`Signed in as ${user.email}. Your changes stay in draft until published.`);
      await loadCatalog();
    } else {
      status(verificationPromptSent
        ? "A verification email was sent. Verify the address, then sign in again."
        : "Sign in with the authorized admin email and password.");
    }
  });
  await loadCatalog();
}

document.querySelector("#admin-open").addEventListener("click", openAdmin);
document.querySelector("#admin-close").addEventListener("click", closeAdmin);
adminSheet.addEventListener("click", (event) => {
  if (event.target === adminSheet) closeAdmin();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && adminSheet.classList.contains("open")) closeAdmin();
});
adminEditor.addEventListener("input", markDraft);
categorySelect.addEventListener("change", () => {
  syncCurrentService();
  if (activeCategoryIndex >= 0) {
    categories[activeCategoryIndex].n = document.querySelector("#admin-category-name").value.trim();
  }
  renderCategories(Number(categorySelect.value));
  markDraft();
});
serviceSelect.addEventListener("change", () => {
  syncCurrentService();
  activeServiceIndex = Number(serviceSelect.value);
  fillServiceForm();
  markDraft();
});
document.querySelector("#admin-add-category").addEventListener("click", () => {
  syncCurrentService();
  if (activeCategoryIndex >= 0) {
    categories[activeCategoryIndex].n = document.querySelector("#admin-category-name").value.trim();
  }
  categories.push({ n: "New category", items: [] });
  renderCategories(categories.length - 1);
  markDraft();
});
document.querySelector("#admin-delete-category").addEventListener("click", () => {
  syncCurrentService();
  if (activeCategoryIndex < 0) return status("Choose a category to remove.", true);
  categories[activeCategoryIndex].n = document.querySelector("#admin-category-name").value.trim();
  if (categories.length === 1) return status("Keep at least one category on the website.", true);
  if (!window.confirm(`Remove the "${categories[activeCategoryIndex].n}" category and all of its services from the draft?`)) return;
  categories.splice(activeCategoryIndex, 1);
  renderCategories(Math.max(0, activeCategoryIndex - 1));
  markDraft();
});
signInButton.addEventListener("click", async () => {
  if (!isFirebaseConfigured) {
    status("Admin sign-in is not configured yet. Complete the Firebase project and admin account setup before signing in.", true);
    return;
  }
  try {
    if (!initialized) await initializeFirebase();
    const email = document.querySelector("#admin-login-email").value.trim();
    const password = document.querySelector("#admin-login-password").value;
    if (!email || !password) {
      status("Enter the admin email and password.", true);
      return;
    }
    verificationPromptSent = false;
    const credential = await authSdk.signInWithEmailAndPassword(auth, email, password);
    document.querySelector("#admin-login-password").value = "";
    if (!credential.user.emailVerified) {
      await authSdk.sendEmailVerification(credential.user);
      verificationPromptSent = true;
      await authSdk.signOut(auth);
      status("A verification email was sent. Verify the address, then sign in again.", true);
    }
  } catch (error) {
    console.error("Admin sign-in failed.", error);
    status("Sign-in failed. Check the email and password, and confirm Firebase Email/Password sign-in is enabled.", true);
  }
});
signOutButton.addEventListener("click", async () => {
  try {
    for (const id of ["admin-login-password", "admin-current-email", "admin-current-password", "admin-new-email", "admin-new-password"]) {
      document.querySelector(`#${id}`).value = "";
    }
    await authSdk.signOut(auth);
  } catch (error) {
    console.error("Admin sign-out failed.", error);
    status("Could not sign out. Close the window and try again.", true);
  }
});
document.querySelector("#admin-change-login").addEventListener("click", async () => {
  const user = auth?.currentUser;
  const currentEmail = document.querySelector("#admin-current-email").value.trim();
  const currentPassword = document.querySelector("#admin-current-password").value;
  const newEmail = document.querySelector("#admin-new-email").value.trim();
  const newPassword = document.querySelector("#admin-new-password").value;
  if (!user || user.uid !== firebaseConfig.adminUid) {
    status("Sign in to the authorized admin account before changing its login.", true);
    return;
  }
  if (!currentEmail || !currentPassword || !newEmail || newPassword.length < 12) {
    status("Enter the current email and password, a new email, and a new password of at least 12 characters.", true);
    return;
  }
  try {
    const credential = authSdk.EmailAuthProvider.credential(currentEmail, currentPassword);
    await authSdk.reauthenticateWithCredential(user, credential);
    await authSdk.updatePassword(user, newPassword);
    document.querySelector("#admin-current-password").value = "";
    document.querySelector("#admin-new-password").value = "";
    try {
      await authSdk.verifyBeforeUpdateEmail(user, newEmail);
      document.querySelector("#admin-current-email").value = "";
      document.querySelector("#admin-new-email").value = "";
      status("Password changed. Confirm the email change using the verification link sent to the new address.");
    } catch (error) {
      console.error("Password changed, but email verification could not be sent.", error);
      status("Your password changed, but Firebase could not send the new-email verification. Sign in again and retry the email change.", true);
    }
  } catch (error) {
    console.error("Admin credential change failed.", error);
    status("Login change failed. The current email and password must be correct, and the new password must meet Firebase requirements.", true);
  }
});
document.querySelector("#admin-add").addEventListener("click", () => {
  syncCurrentService();
  const category = categories[activeCategoryIndex];
  if (!category) return status("Choose a category before adding a service.", true);
  category.items.push({ n: "New service", lo: 0, hi: 0, per: 0, t: "Same day", d: "", b: [], ask: [] });
  renderServiceOptions(category.items.length - 1);
  markDraft();
});
document.querySelector("#admin-delete").addEventListener("click", async () => {
  syncCurrentService();
  const category = categories[activeCategoryIndex];
  const serviceIndex = activeServiceIndex;
  if (!category?.items[serviceIndex]) return status("Choose a service to delete.", true);
  if (!window.confirm(`Delete "${category.items[serviceIndex].n}" from the public catalog?`)) return;
  category.items.splice(serviceIndex, 1);
  renderServiceOptions(Math.max(0, serviceIndex - 1));
  markDraft();
});
document.querySelector("#admin-publish").addEventListener("click", publishChanges);

if (isFirebaseConfigured) {
  initializeFirebase().catch((error) => {
    console.error("Firebase initialization failed.", error);
    status("Admin sign-in could not connect to Firebase. Check the Firebase setup and try again.", true);
  });
} else {
  adminLoginForm.hidden = true;
}
