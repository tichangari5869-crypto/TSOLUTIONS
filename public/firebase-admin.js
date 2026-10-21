import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const adminSheet = document.querySelector("#admin-sheet");
const adminStatus = document.querySelector("#admin-status");
const adminEditor = document.querySelector("#admin-editor");
const signInButton = document.querySelector("#admin-sign-in");
const signOutButton = document.querySelector("#admin-sign-out");
const categorySelect = document.querySelector("#admin-category");
const serviceSelect = document.querySelector("#admin-service");
const catalogRefPath = ["site", "catalog"];
const version = "12.4.0";

let categories = [];
let auth;
let database;
let googleProvider;
let firestore;
let initialized = false;

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
    status("Admin sign-in is not configured yet. Set up the Firebase project and admin email in the deployment instructions.", true);
  } else if (!initialized) {
    initializeFirebase().catch((error) => {
      console.error("Firebase admin setup failed.", error);
      status("Admin sign-in could not connect to Firebase. Check the Firebase setup and try again.", true);
    });
  }
  signInButton.focus();
}

function currentService() {
  const categoryIndex = Number(categorySelect.value);
  const serviceIndex = Number(serviceSelect.value);
  return categories[categoryIndex]?.items[serviceIndex];
}

function renderServiceOptions(preferredIndex = serviceSelect.value) {
  const category = categories[Number(categorySelect.value)];
  const items = category?.items || [];
  serviceSelect.replaceChildren(...items.map((item, index) =>
    new Option(`${index + 1}. ${item.n}`, String(index))
  ));
  if (items.length) {
    const index = Math.min(Number(preferredIndex) || 0, items.length - 1);
    serviceSelect.value = String(index);
    fillServiceForm();
  } else {
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

function renderCategories(preferredIndex = categorySelect.value) {
  categorySelect.replaceChildren(...categories.map((category, index) =>
    new Option(category.n, String(index))
  ));
  if (categories.length) {
    const index = Math.min(Number(preferredIndex) || 0, categories.length - 1);
    categorySelect.value = String(index);
  }
  renderServiceOptions();
}

function validateService(service) {
  return service.n.trim() && service.t.trim() && service.d.trim() &&
    Number.isFinite(service.lo) && service.lo >= 0 &&
    Number.isFinite(service.hi) && service.hi >= service.lo &&
    service.b.length > 0;
}

async function saveCatalog(message) {
  const categoryIndex = Number(categorySelect.value);
  if (!categories[categoryIndex]) {
    status("Choose a category before saving.", true);
    return;
  }
  const item = {
    n: document.querySelector("#admin-name").value.trim(),
    lo: Number(document.querySelector("#admin-low").value),
    hi: Number(document.querySelector("#admin-high").value),
    per: document.querySelector("#admin-per-page").checked ? 1 : 0,
    t: document.querySelector("#admin-time").value.trim(),
    d: document.querySelector("#admin-delivery").value.trim(),
    b: document.querySelector("#admin-bring").value.split("\n").map((value) => value.trim()).filter(Boolean),
    ask: document.querySelector("#admin-ask").value.split("\n").map((value) => value.trim()).filter(Boolean)
  };
  if (!validateService(item)) {
    status("Enter a service name, valid prices, turnaround time, delivery details, and at least one item to bring.", true);
    return;
  }

  const updatedCategories = categories.map((category) => ({
    ...category,
    items: category.items.map((existing) => ({
      ...existing,
      b: [...existing.b],
      ask: [...existing.ask]
    }))
  }));
  const serviceIndex = Number(serviceSelect.value);
  if (Number.isInteger(serviceIndex) && updatedCategories[categoryIndex].items[serviceIndex]) {
    updatedCategories[categoryIndex].items[serviceIndex] = item;
  } else {
    updatedCategories[categoryIndex].items.push(item);
  }

  try {
    await firestore.setDoc(firestore.doc(database, ...catalogRefPath), { categories: updatedCategories });
    categories = updatedCategories;
    window.dispatchEvent(new CustomEvent("service-catalog-loaded", { detail: categories }));
    renderServiceOptions(categories[categoryIndex].items.indexOf(item));
    status(message);
  } catch (error) {
    console.error("Unable to save the service catalog.", error);
    status("Could not save changes. Check your Firestore security rules and connection, then try again.", true);
  }
}

async function loadCatalog() {
  try {
    const snapshot = await firestore.getDoc(firestore.doc(database, ...catalogRefPath));
    if (!snapshot.exists()) return;
    const savedCategories = snapshot.data().categories;
    if (!Array.isArray(savedCategories) || savedCategories.some((category) =>
      !category || typeof category.n !== "string" || !Array.isArray(category.items) ||
      category.items.some((item) => !item || typeof item.n !== "string" ||
        !Array.isArray(item.b) || !Array.isArray(item.ask))
    )) {
      throw new Error("Stored catalog has an invalid format.");
    }
    categories = savedCategories;
    window.dispatchEvent(new CustomEvent("service-catalog-loaded", { detail: categories }));
    if (auth.currentUser?.email?.toLowerCase() === firebaseConfig.adminEmail.trim().toLowerCase()) {
      renderCategories();
    }
  } catch (error) {
    console.error("Unable to load the saved service catalog.", error);
    status("Could not load saved services. The public catalog is still available; check Firestore access.", true);
  }
}

window.addEventListener("service-catalog-loaded", (event) => {
  if (!Array.isArray(event.detail)) return;
  categories = event.detail;
  if (adminEditor.hidden) return;
  renderCategories();
});

async function initializeFirebase() {
  if (initialized) return;
  status("Connecting to Firebase…");
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
  ]);
  const app = appSdk.initializeApp(firebaseConfig);
  auth = authSdk.getAuth(app);
  database = firestoreSdk.getFirestore(app);
  firestore = firestoreSdk;
  googleProvider = new authSdk.GoogleAuthProvider();
  initialized = true;

  authSdk.onAuthStateChanged(auth, async (user) => {
    const authorized = Boolean(
      user?.emailVerified &&
      user.email?.toLowerCase() === firebaseConfig.adminEmail.trim().toLowerCase()
    );
    adminEditor.hidden = !authorized;
    signInButton.hidden = authorized;
    if (user && !authorized) {
      status("This Google account is not authorized to manage the site.", true);
      await authSdk.signOut(auth);
      return;
    }
    if (authorized) {
      status(`Signed in as ${user.email}. Service changes are saved to the live catalog.`);
      await loadCatalog();
    } else {
      status("Sign in with the authorized Google account to manage services.");
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
categorySelect.addEventListener("change", () => renderServiceOptions());
serviceSelect.addEventListener("change", fillServiceForm);
signInButton.addEventListener("click", async () => {
  if (!isFirebaseConfigured) {
    status("Admin sign-in is not configured yet. Set up Firebase before signing in.", true);
    return;
  }
  try {
    if (!initialized) await initializeFirebase();
    await (await import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`))
      .signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Google admin sign-in failed.", error);
    status("Sign-in failed. Check the authorized Google account and Firebase Authentication setup.", true);
  }
});
signOutButton.addEventListener("click", async () => {
  try {
    const authSdk = await import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`);
    await authSdk.signOut(auth);
  } catch (error) {
    console.error("Admin sign-out failed.", error);
    status("Could not sign out. Close the window and try again.", true);
  }
});
document.querySelector("#admin-save").addEventListener("click", () => saveCatalog("Service saved."));
document.querySelector("#admin-add").addEventListener("click", () => {
  const category = categories[Number(categorySelect.value)];
  if (!category) return status("Choose a category before adding a service.", true);
  category.items.push({ n: "New service", lo: 0, hi: 0, per: 0, t: "Same day", d: "", b: [], ask: [] });
  renderServiceOptions(category.items.length - 1);
  status("Complete the new service details and save it.");
});
document.querySelector("#admin-delete").addEventListener("click", async () => {
  const category = categories[Number(categorySelect.value)];
  const serviceIndex = Number(serviceSelect.value);
  if (!category?.items[serviceIndex]) return status("Choose a service to delete.", true);
  if (!window.confirm(`Delete "${category.items[serviceIndex].n}" from the public catalog?`)) return;
  const updatedCategories = categories.map((entry) => ({
    ...entry,
    items: entry.items.map((existing) => ({
      ...existing,
      b: [...existing.b],
      ask: [...existing.ask]
    }))
  }));
  updatedCategories[Number(categorySelect.value)].items.splice(serviceIndex, 1);
  try {
    await firestore.setDoc(firestore.doc(database, ...catalogRefPath), { categories: updatedCategories });
    categories = updatedCategories;
    window.dispatchEvent(new CustomEvent("service-catalog-loaded", { detail: categories }));
    renderServiceOptions(Math.max(0, serviceIndex - 1));
    status("Service deleted.");
  } catch (error) {
    console.error("Unable to delete the service.", error);
    status("Could not delete the service. Check your Firestore security rules and try again.", true);
  }
});

if (isFirebaseConfigured) {
  initializeFirebase().catch((error) => {
    console.error("Firebase initialization failed.", error);
    status("Admin sign-in could not connect to Firebase. Check the Firebase setup and try again.", true);
  });
}
