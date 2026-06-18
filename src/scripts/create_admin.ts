import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import supabase from '../lib/db';
import { generateSalt, hashPassword } from '../lib/auth/crypto';

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('❌ Usage: npx tsx src/scripts/create_admin.ts <username> <password>');
    process.exit(1);
  }

  const username = args[0].trim();
  const password = args[1].trim();

  if (!username || !password) {
    console.error('❌ Username and password cannot be empty.');
    process.exit(1);
  }

  console.log(`🌱 Creating admin user "${username}" in Supabase...`);

  // Generate salt and hash the password
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);

  const adminRecord = {
    username,
    password_hash: passwordHash,
    salt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('discovery_admins')
    .upsert([adminRecord], { onConflict: 'username' });

  if (error) {
    console.error('❌ Failed to insert admin user:', error.message);
    process.exit(1);
  }

  console.log(`✅ Admin user "${username}" created/updated successfully!`);
}

main().catch((err) => {
  console.error('❌ Error executing script:', err);
  process.exit(1);
});
