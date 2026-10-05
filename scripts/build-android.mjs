// Android release build: production web build → Capacitor sync → Gradle.
// Produces an AAB (Play Store) and an APK (direct install on a phone/emulator).
//
//   npm run build:android
//
// Signed when android/keystore.properties exists (see keystore.properties.example).
// "Publishable" only when src/environments/environment.prod.ts points to a hosted
// (https) Supabase: the development network flags are then removed.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const android = join(root, 'android');
const run = (command, options = {}) => execSync(command, { stdio: 'inherit', cwd: root, ...options });

const prodEnv = readFileSync(join(root, 'src/environments/environment.prod.ts'), 'utf8');
const hosted = /url:\s*'https:\/\//.test(prodEnv);
const signed = existsSync(join(android, 'keystore.properties'));

if (!hosted) {
  console.warn('\n⚠  environment.prod.ts points to the local Supabase (http): TEST build only, not publishable.\n');
}
if (!signed) {
  console.warn('\n⚠  android/keystore.properties missing: the release build will be UNSIGNED.\n');
}

// Gradle needs a JDK: use the one bundled with Android Studio when JAVA_HOME is not set.
const env = { ...process.env, BREADING_RELEASE: hosted ? '1' : '0' };
const studioJdk = 'C:\\Program Files\\Android\\Android Studio\\jbr';
if (!env.JAVA_HOME && existsSync(studioJdk)) env.JAVA_HOME = studioJdk;
// And the Android SDK (normally written to android/local.properties by Android Studio).
const defaultSdk = join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
if (!env.ANDROID_HOME && !existsSync(join(android, 'local.properties')) && existsSync(defaultSdk)) env.ANDROID_HOME = defaultSdk;

run('npx ng build --configuration production');
run('npx cap sync android', { env });
// Full path: cmd.exe does not look for programs in the current folder.
const gradle = process.platform === 'win32' ? `"${join(android, 'gradlew.bat')}"` : './gradlew';
run(`${gradle} bundleRelease assembleRelease`, { cwd: android, env });

console.log(`
✔ Done${signed ? '' : ' (unsigned)'}${hosted ? '' : ' — test build, local Supabase'}:
  AAB (Play Store): android/app/build/outputs/bundle/release/app-release.aab
  APK:              android/app/build/outputs/apk/release/app-release${signed ? '' : '-unsigned'}.apk
`);
