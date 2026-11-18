import { getDb } from '../src/server/db.ts';
import {
  syncOfficialPincodesDataset,
  syncOfficialRazorpayIfscDataset,
} from '../src/server/importers.ts';

async function main() {
  const db = getDb();
  const pinCountBefore = Number(
    (db.prepare('SELECT COUNT(*) as c FROM india_pincodes').get() as { c: number }).c
  );
  const ifscCountBefore = Number(
    (db.prepare('SELECT COUNT(*) as c FROM india_ifsc').get() as { c: number }).c
  );

  console.log(`Starting seed check. Existing rows -> Pincodes: ${pinCountBefore}, IFSC: ${ifscCountBefore}`);

  if (pinCountBefore === 0 || process.argv.includes('--force-pins')) {
    console.log('Syncing India Post PIN codes dataset...');
    const pinRes = await syncOfficialPincodesDataset('seed-script');
    console.log('PIN sync completed:', JSON.stringify({
      totalRows: pinRes.totalRows,
      insertedRows: pinRes.insertedRows,
      updatedRows: pinRes.updatedRows,
      duplicateRows: pinRes.duplicateRows,
      invalidRows: pinRes.invalidRows,
      missingFieldsRows: pinRes.missingFieldsRows,
    }));
  }

  if (ifscCountBefore === 0 || process.argv.includes('--force-ifsc')) {
    console.log('Syncing Razorpay official IFSC dataset...');
    const ifscRes = await syncOfficialRazorpayIfscDataset('seed-script');
    console.log('IFSC sync completed:', JSON.stringify({
      totalRows: ifscRes.totalRows,
      insertedRows: ifscRes.insertedRows,
      updatedRows: ifscRes.updatedRows,
      duplicateRows: ifscRes.duplicateRows,
      invalidRows: ifscRes.invalidRows,
      missingFieldsRows: ifscRes.missingFieldsRows,
    }));
  }

  const finalPins = Number(
    (db.prepare('SELECT COUNT(*) as c FROM india_pincodes').get() as { c: number }).c
  );
  const finalUniquePins = Number(
    (db.prepare('SELECT COUNT(DISTINCT pincode) as c FROM india_pincodes').get() as { c: number }).c
  );
  const finalIfsc = Number(
    (db.prepare('SELECT COUNT(*) as c FROM india_ifsc').get() as { c: number }).c
  );

  console.log(
    `Database ready -> Post Offices: ${finalPins}, Unique PINs: ${finalUniquePins}, IFSC Branches: ${finalIfsc}`
  );
}

main().catch((err) => {
  console.error('Dataset seeding failed:', err);
  process.exit(1);
});
