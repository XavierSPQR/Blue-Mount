# Blue Mount Tea

Tea leaf collection, supplier/collector management, and pay slip generation for Blue Mount — a Next.js static export on Firebase Hosting (Spark/free plan), backed by Firestore + Auth. See `IMPLEMENTATION_PLAN.md` for the full architecture, phase-by-phase build log, and the assumptions/decisions behind it.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in from `firebase apps:sdkconfig WEB <appId>`
npm run dev
```

## Build & deploy

```bash
npm run build                # static export to out/
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

## Testing the Firestore security rules

Rules are the real backend authorization layer here (see `firestore.rules` and `IMPLEMENTATION_PLAN.md` Phase 8) — they're unit-tested against the Firestore emulator, not just trusted by inspection.

```bash
npm run test:rules
```

This spins up the Firestore emulator (via `firebase emulators:exec`) and runs `tests/rules/firestore.rules.test.ts` against it with `@firebase/rules-unit-testing`.

**Requires a JDK 21+ on `PATH`** (the Firestore emulator's runtime requirement) — this repo was built in an environment with only JDK 17 installed, so a portable JDK 21 was used instead of a system package:

```bash
mkdir -p ~/.local/jdk && cd ~/.local/jdk
curl -sL "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse" -o jdk21.tar.gz
tar xzf jdk21.tar.gz && rm jdk21.tar.gz
export JAVA_HOME=~/.local/jdk/jdk-21* PATH="$JAVA_HOME/bin:$PATH"   # add to your shell profile to persist
```

If `java -version` on your machine is already 21+, skip straight to `npm run test:rules`.
