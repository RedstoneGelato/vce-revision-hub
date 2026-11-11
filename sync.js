// Firebase sign-in (GitHub) and cloud progress. Loaded only when config.js has a firebaseConfig.
const V = "10.12.2";
const base = `https://www.gstatic.com/firebasejs/${V}`;

export async function initSync(config, onUser) {
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const { getAuth, GithubAuthProvider, signInWithPopup, signOut, onAuthStateChanged, getAdditionalUserInfo } =
    await import(`${base}/firebase-auth.js`);
  const { getFirestore, doc, getDoc, setDoc, collection, getDocs } = await import(`${base}/firebase-firestore.js`);

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let githubName = null;

  onAuthStateChanged(auth, (u) => onUser(u ? {
    uid: u.uid,
    name: githubName || u.displayName || u.reloadUserInfo?.screenName || u.email || "GitHub user",
    photo: u.photoURL || "",
  } : null));

  return {
    async signIn() {
      const res = await signInWithPopup(auth, new GithubAuthProvider());
      githubName = getAdditionalUserInfo(res)?.username || null;
      return githubName;
    },
    signOut: () => signOut(auth),
    async load(uid) {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) return null;
      const d = snap.data();
      try { return JSON.parse(d.state); } catch { return null; }
    },
    save(uid, state, profile, summary) {
      // State is stored as a JSON string so question ids with dots stay plain map keys.
      return setDoc(doc(db, "users", uid), {
        state: JSON.stringify(state), name: profile.name, photo: profile.photo || "",
        summary, updated: Date.now(),
      });
    },
    async listAll() {
      const snaps = await getDocs(collection(db, "users"));
      return snaps.docs.map((s) => ({ uid: s.id, ...s.data() }));
    },
  };
}
