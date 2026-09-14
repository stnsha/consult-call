-- Temporary access window for ConsultCall staff.
-- One row per staff_id: presence of a row means the staff's consult_call
-- access is time-boxed. No row = no timeline (permanent access).
CREATE TABLE IF NOT EXISTS `staff_cc` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `staff_id` INT UNSIGNED NOT NULL,
  `active_from` DATE NOT NULL,
  `active_to` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_staff_cc_staff_id` (`staff_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
