<?php
/**
 * ConsultCall role helpers.
 *
 * staff.consult_call stores a comma-separated list of role IDs, e.g. "2,6" for a
 * Doctor who is also an Admin. "0" (or empty) means Normal User (no roles).
 *
 *   1 = Super Admin, 2 = Doctor, 3 = Pharmacy, 4 = Customer Support,
 *   5 = Outlet, 6 = Admin
 */

const CONSULT_CALL_ROLE_IDS = [1, 2, 3, 4, 5, 6];

/**
 * Parse a staff.consult_call value into a sorted list of unique role IDs.
 * Unknown values and 0 (Normal User) are dropped.
 *
 * @return int[]
 */
function parseConsultCallRoles(string|int|null $value): array
{
    $roles = array_map('intval', explode(',', (string) ($value ?? '')));
    $roles = array_values(array_unique(array_intersect($roles, CONSULT_CALL_ROLE_IDS)));
    sort($roles);

    return $roles;
}

/**
 * Format role IDs for storage in staff.consult_call ("0" when there are none).
 *
 * @param int[] $roles
 */
function formatConsultCallRoles(array $roles): string
{
    $roles = parseConsultCallRoles(implode(',', $roles));

    return $roles ? implode(',', $roles) : '0';
}

/**
 * Whether the role list contains any of the given roles.
 *
 * @param int[] $roles
 */
function hasConsultCallRole(array $roles, int ...$wanted): bool
{
    return (bool) array_intersect($roles, $wanted);
}

/**
 * Single role sent to the Laravel API in the JWT, which only distinguishes
 * Super Admin: 1 when present, otherwise the lowest role, or 0 for none.
 *
 * @param int[] $roles
 */
function primaryConsultCallRole(array $roles): int
{
    if (in_array(1, $roles, true)) {
        return 1;
    }

    return $roles ? min($roles) : 0;
}

/**
 * Current staff's roles from staff.consult_call, with the localhost-only dev
 * role override (navbar.php / dev-switch-role.php) applied when set: the
 * override replaces the real roles with that single role (0 = Normal User).
 *
 * @return int[]
 */
function resolveConsultCallRoles(mysqli $conn, int|string $staffId): array
{
    $roles = [];
    $id = mysqli_real_escape_string($conn, (string) $staffId);
    $result = mysqli_query($conn, "SELECT consult_call FROM staff WHERE id = '$id'");
    if ($result && ($row = mysqli_fetch_assoc($result))) {
        $roles = parseConsultCallRoles($row['consult_call'] ?? '');
    }

    if (isConsultCallLocalhost() && isset($_SESSION['dev_role_override'])) {
        $roles = parseConsultCallRoles((int) $_SESSION['dev_role_override']);
    }

    return $roles;
}

/**
 * Same localhost detection the pages used for the dev role override.
 */
function isConsultCallLocalhost(): bool
{
    $serverName = $_SERVER['SERVER_NAME'] ?? '';
    $httpHost = $_SERVER['HTTP_HOST'] ?? '';

    return in_array($serverName, ['localhost', '127.0.0.1'], true)
        || str_contains($httpHost, 'localhost')
        || str_contains($httpHost, '127.0.0.1');
}
