-- Read-only verification. Schema changes belong exclusively to Alembic.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;

SELECT * FROM alembic_version;

SELECT * FROM buildings ORDER BY building_id;

SELECT b.building_name, e.equipment_name, e.equipment_type, e.location, e.status
FROM equipment e JOIN buildings b ON e.building_id = b.building_id
ORDER BY b.building_name, e.equipment_name;

SELECT b.building_name, er.temperature, er.humidity, er.energy_consumption, er.recorded_at
FROM environmental_readings er JOIN buildings b ON er.building_id = b.building_id
ORDER BY b.building_name, er.recorded_at DESC;

SELECT 'buildings' AS table_name, count(*) FROM buildings
UNION ALL SELECT 'equipment', count(*) FROM equipment
UNION ALL SELECT 'environmental_readings', count(*) FROM environmental_readings
UNION ALL SELECT 'users', count(*) FROM users
UNION ALL SELECT 'maintenance_requests', count(*) FROM maintenance_requests
UNION ALL SELECT 'request_status_history', count(*) FROM request_status_history
UNION ALL SELECT 'maintenance_history', count(*) FROM maintenance_history;

SELECT c.relname AS table_name, con.conname, con.contype,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' ORDER BY c.relname, con.conname;

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;
