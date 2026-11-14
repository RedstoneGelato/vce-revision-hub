// Fill these in to turn on "Sign in with GitHub" and per-account progress (see README.md).
// Until then the site still works and saves progress in each browser.

// Paste the firebaseConfig object from Firebase console > Project settings > Your apps > Web app.
export const firebaseConfig = null;
// Example shape (these are not real values):
// export const firebaseConfig = {
//   apiKey: "AIza...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   appId: "1:123:web:abc"
// };

// Firebase user IDs (UIDs) allowed to open the Tutor page and see every student's progress.
// Sign in once, open the Progress page, copy "Your account ID" here, and add it to firestore.rules too.
export const tutorUids = [];

// "Report a problem" opens a new GitHub issue on this repo, pre-filled with the page and question.
// Reporters need a free GitHub account. The link adds ?title=...&body=..., which is GitHub's format.
export const reportUrl = "https://github.com/RedstoneGelato/vce-revision-hub/issues/new";
