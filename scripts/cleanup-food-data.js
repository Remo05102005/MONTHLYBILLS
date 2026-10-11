#!/usr/bin/env node
/**
 * Removes the retired food-tracking data from Realtime Database:
 *   users/{uid}/weights/{weightId}/food   (food intake entries on weight records)
 *   users/{uid}/foodData                  (cached nutrient lookups)
 * Weights, settings, expenses and everything else are left untouched.
 *
 * Usage (dry run by default - prints what would be removed):
 *   node scripts/cleanup-food-data.js --key path/to/serviceAccount.json
 *   node scripts/cleanup-food-data.js --key path/to/serviceAccount.json --apply
 *   node scripts/cleanup-food-data.js --key ... --apply --backup food-backup.json
 *
 * --key falls back to GOOGLE_APPLICATION_CREDENTIALS. --db overrides the database URL.
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const keyPath = opt('key') || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const dbUrl = opt('db') || 'https://aadhyayavyaya-default-rtdb.asia-southeast1.firebasedatabase.app';
const apply = flag('apply');
const backupPath = opt('backup');

if (apply && !backupPath) {
  console.error('Refusing to delete without a backup. Add --backup <file.json>.');
  process.exit(1);
}

if (!keyPath) {
  console.error('Missing service account key. Pass --key <file> or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(path.resolve(keyPath), 'utf8'))),
  databaseURL: dbUrl,
});
const db = admin.database();

const count = (v) => (v && typeof v === 'object' ? Object.keys(v).length : 0);

async function userIds() {
  // shallow listing so we never download the whole database
  const token = (await admin.app().options.credential.getAccessToken()).access_token;
  const res = await fetch(`${dbUrl}/users.json?shallow=true`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Could not list users: ${res.status} ${await res.text()}`);
  return Object.keys((await res.json()) || {});
}

async function main() {
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} - database: ${dbUrl}`);
  const uids = await userIds();
  console.log(`Users: ${uids.length}`);

  const backup = {};
  const updates = {};
  let foodEntries = 0;
  let weightRecords = 0;
  let foodDataItems = 0;

  for (const uid of uids) {
    const [weightsSnap, foodDataSnap] = await Promise.all([
      db.ref(`users/${uid}/weights`).get(),
      db.ref(`users/${uid}/foodData`).get(),
    ]);

    const weights = weightsSnap.val() || {};
    for (const [wid, rec] of Object.entries(weights)) {
      if (rec && rec.food !== undefined) {
        weightRecords += 1;
        // entries are either {pushId: entry} or {date: {pushId: entry}} depending on app version
        foodEntries += Object.values(rec.food || {}).reduce(
          (n, v) => n + (v && typeof v === 'object' && !('foodItem' in v) ? count(v) : 1), 0);
        updates[`users/${uid}/weights/${wid}/food`] = null;
        if (backupPath) backup[`users/${uid}/weights/${wid}/food`] = rec.food;
      }
    }

    if (foodDataSnap.exists()) {
      foodDataItems += count(foodDataSnap.val());
      updates[`users/${uid}/foodData`] = null;
      if (backupPath) backup[`users/${uid}/foodData`] = foodDataSnap.val();
    }
  }

  console.log(`Weight records with food: ${weightRecords} (${foodEntries} food entries)`);
  console.log(`Cached foodData items:   ${foodDataItems}`);
  console.log(`Paths to remove:         ${Object.keys(updates).length}`);

  if (Object.keys(updates).length === 0) {
    console.log('Nothing to clean up.');
    return;
  }
  if (!apply) {
    Object.keys(updates).slice(0, 20).forEach((p) => console.log(`  would delete ${p}`));
    if (Object.keys(updates).length > 20) console.log(`  ... and ${Object.keys(updates).length - 20} more`);
    console.log('\nRe-run with --apply to delete.');
    return;
  }

  if (backupPath) {
    fs.writeFileSync(path.resolve(backupPath), JSON.stringify(backup, null, 2));
    console.log(`Backup written to ${backupPath}`);
  }
  await db.ref().update(updates);
  console.log('Done - food data removed.');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
