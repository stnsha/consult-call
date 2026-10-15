-- ConsultCall: allow a staff to hold more than one ConsultCall role.
--
-- staff.consult_call changes from a single INT role to a comma-separated list of
-- role IDs, e.g. '2,6' for a Doctor who is also an Admin. '0' = Normal User.
--   1 = Super Admin, 2 = Doctor, 3 = Pharmacy, 4 = Customer Support,
--   5 = Outlet, 6 = Admin
--
-- Existing values convert as-is (2 -> '2'), so no data update is needed.
-- Run once on the odb database, before deploying the matching consultcall code.
--
-- The ALTER rebuilds the staff table, and strict SQL mode would reject existing
-- '0000-00-00' values in other columns (e.g. ap_status). The session sql_mode is
-- relaxed for this statement only and restored afterwards; no other column changes.

SET @consultcall_old_sql_mode = @@SESSION.sql_mode;
SET SESSION sql_mode = '';

ALTER TABLE staff
    MODIFY consult_call VARCHAR(50) NOT NULL DEFAULT '0';

SET SESSION sql_mode = @consultcall_old_sql_mode;
