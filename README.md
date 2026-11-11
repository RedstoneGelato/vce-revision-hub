# VCE Revision Hub

A revision site for VCE Chemistry, English Language, Accounting, Mathematical Methods and General Mathematics (Units 1/2 and 3/4).

- **Learn:** key points for every topic, an "explain it back" prompt, and an "In depth" section with explanations, worked examples and common mistakes.
- **Glossary:** searchable definitions for every subject, each labelled with where its wording comes from.
- **Practise:** multiple-choice and flashcard questions. Options are shuffled each time.
- **Review:** spaced repetition. Correct answers come back after 1, 2, 4, 7, 15 then 30 days; missed ones come back the next day.
- **Mixed quiz:** questions drawn from several subjects at once.
- **Error log:** every miss is saved, with a note box and a redo button.
- **Progress:** mastery for each subject, a 14-day activity chart and a progress code for backups.
- **Tutor view:** the tutor can see every student's progress (needs the Firebase setup below).

It runs as a plain static site on GitHub Pages. There is no build step.

## Turning on "Sign in with GitHub" (about 10 minutes, free)

Until this is done, progress is saved in each browser. After it's done, each student signs in with GitHub and their progress follows them to any device.

1. **Create a Firebase project.**
   - Go to <https://console.firebase.google.com>, choose **Add project**, give it any name (Google Analytics can be off) and create it.
   - Under **Project settings → Your apps**, click the **Web** icon `</>` and register an app called `vce-hub`.
   - Copy the `firebaseConfig` object it shows.
2. **Turn on Firestore.**
   - Go to **Build → Firestore Database → Create database**.
   - Choose a location near you (`australia-southeast1`) and start in **production mode**.
3. **Create a GitHub OAuth app.**
   - In Firebase, go to **Build → Authentication → Get started → Sign-in method → GitHub**, switch it on, and copy the **callback URL** it shows.
   - In GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**. Use the site URL as the Homepage URL, paste the Firebase callback URL as the Authorization callback URL, then register the app.
   - Copy the **Client ID**, generate a **Client secret**, and paste both into the Firebase GitHub provider. Save.
4. **Allow the site's domain.**
   - Go to **Authentication → Settings → Authorized domains → Add domain** and add `redstonegelato.github.io`.
5. **Paste the config.**
   - In this repo, edit `config.js` and replace `export const firebaseConfig = null;` with the object you copied in step 1.
   - Commit the change. The Firebase web config is not a secret; access is controlled by the rules in step 7.
6. **Become the tutor.**
   - Open the site, sign in with GitHub, go to **Progress**, and copy **Your account ID**.
   - Put it in `tutorUids` in `config.js`, e.g. `export const tutorUids = ["abc123..."];`.
7. **Set the security rules.**
   - In **Firestore → Rules**, paste the contents of `firestore.rules`.
   - Replace `PASTE_TUTOR_ACCOUNT_ID_HERE` with the same ID, then **Publish**.

Students can now sign in with their own GitHub accounts. Anything they did before signing in is merged into their account.

## Editing content

Each subject and unit has its own file in `content/`, for example `chem12.json` or `meth34.json`. A topic looks like this:

```json
{"id": "atoms", "title": "Atoms", "points": ["…"], "explain": "…",
 "notes": [{"h": "Section heading", "p": ["A paragraph.", "Another paragraph."]}],
 "qs": [
   {"t": "m", "q": "Question?", "o": ["A", "B", "C", "D"], "a": 1, "e": "Why B is right"},
   {"t": "c", "q": "Flashcard question", "a": "Answer", "e": ""}
 ]}
```

- `"t": "m"` is multiple choice. `a` is the index of the correct option, counting from 0.
- `"t": "c"` is a flashcard the student marks themselves.
- Add new questions **at the end** of a topic's `qs` list, and don't change topic `id`s. Progress is tracked by topic id and question position, so reordering would mix up saved progress.
- `notes` is optional: each entry is a heading and its paragraphs, shown under "In depth".

### Glossary

`content/glossary.json` is a list of terms:

```json
{"t": "Relevance", "d": "The definition.", "s": "acc", "src": "VCE Accounting Study Design 2025–2029, p. 12"}
```

- `s` is the subject key: `chem`, `eng`, `acc`, `meth` or `gen`.
- `src` is optional. Add it only when `d` is copied word for word from a VCAA document, and name the document. Entries without `src` are shown as "Study-note wording".
