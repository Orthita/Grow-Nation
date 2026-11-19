// One-time update: writes the official contact details into an existing database.
// Only touches office_address, phone, email and website. Leaves every other setting alone.
// Usage: npm run update-settings
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../server/db');

const VALUES = {
  office_address: 'House No-86/1, Jamurun Nessa Palace (Level-03), Adabor Bazar Road, Mohammadpur PS, Dhaka-1207, Bangladesh',
  phone: '+88 01726511168',
  email: 'grownationbd@gmail.com',
  website: 'www.grownation.org',
};

(async () => {
  for (const [key, value] of Object.entries(VALUES)) {
    await pool.execute(
      'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
      [key, value]
    );
    console.log(`  ${key} = ${value}`);
  }
  console.log('Settings updated.');
  await pool.end();
})().catch(async (e) => {
  console.error('update-settings failed:', e.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
