-- One-time fix-up for environments where staff_cc accumulated duplicate rows
-- per staff_id (because the table was missing the UNIQUE KEY from
-- sql/staff_cc.sql, so INSERT ... ON DUPLICATE KEY UPDATE always inserted).
-- Safe to run more than once. Run this against the affected database.

-- 1. Keep only the most recently updated row per staff_id, drop the rest.
DELETE t1 FROM staff_cc t1
INNER JOIN staff_cc t2
  ON t1.staff_id = t2.staff_id
 AND (t1.updated_at < t2.updated_at OR (t1.updated_at = t2.updated_at AND t1.id < t2.id));

-- 2. Add the missing unique constraint so this cannot happen again.
--    If it already exists, this statement errors harmlessly -- ignore that error.
ALTER TABLE staff_cc ADD UNIQUE KEY uk_staff_cc_staff_id (staff_id);
