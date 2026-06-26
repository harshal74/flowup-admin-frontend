-- Allow anonymous access for all tables (for custom JWT auth flow)
CREATE POLICY "categories_anon_access" ON categories FOR ALL TO anon USING (true);
CREATE POLICY "menu_items_anon_access" ON menu_items FOR ALL TO anon USING (true);
CREATE POLICY "customers_anon_access" ON customers FOR ALL TO anon USING (true);
CREATE POLICY "orders_anon_access" ON orders FOR ALL TO anon USING (true);
CREATE POLICY "order_items_anon_access" ON order_items FOR ALL TO anon USING (true);
CREATE POLICY "notifications_anon_access" ON notifications FOR ALL TO anon USING (true);
CREATE POLICY "restaurants_anon_update" ON restaurants FOR ALL TO anon USING (true);