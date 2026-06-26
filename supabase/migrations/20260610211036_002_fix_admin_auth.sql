-- Allow anonymous users to read admin_users (needed for login check)
CREATE POLICY "admin_users_anon_read" ON admin_users FOR SELECT TO anon USING (true);

-- Also allow anon to update last_login after successful auth
CREATE POLICY "admin_users_anon_update" ON admin_users FOR UPDATE TO anon USING (true);