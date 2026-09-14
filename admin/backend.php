<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
header('Content-Type: application/json');

if (session_id() == '') {
    session_start();
}

if (!isset($_SESSION['myusername'])) {
    echo json_encode(array('error' => 'Unauthorized'));
    exit;
}

$connect = 1;
include(__DIR__ . '/../../common/index_adv.php');

if (!isset($conn)) {
    echo json_encode(array('error' => 'Database connection error'));
    exit;
}

// Verify requester has admin-page access using session username. Real DB
// role is used here (not any dev-role-override in session) so this stays
// authoritative regardless of client-side/dev state -- see CLAUDE.md.
$username   = mysqli_real_escape_string($conn, $_SESSION['myusername']);
$auth_query = "SELECT id, consult_call FROM staff WHERE username = '$username' AND recycle != 1";
$auth_result = mysqli_query($conn, $auth_query);
if (!$auth_result || mysqli_num_rows($auth_result) === 0) {
    echo json_encode(array('error' => 'Unauthorized'));
    exit;
}
$auth_row       = mysqli_fetch_assoc($auth_result);
$requester_id   = (int)$auth_row['id'];
$requester_role = (int)$auth_row['consult_call'];

// Full Super Admin (role 1) can manage anyone. Role 6 (Admin) and hardcoded
// staff id 5138 get restricted access: they cannot assign the Super Admin
// role, and cannot edit a staff who currently holds it.
$is_full_super_admin = ($requester_role === 1);
$is_authorized = $is_full_super_admin || $requester_role === 6 || $requester_id === 5138;
if (!$is_authorized) {
    echo json_encode(array('error' => 'Unauthorized'));
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$_request_method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '';

if ($action === 'getOutlets' && $_request_method === 'GET') {
    $result = mysqli_query($conn, "SELECT id, code, comp_name FROM outlet WHERE recycle = '0' ORDER BY comp_name ASC");
    $outlets = array();
    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $outlets[] = array(
                'id'        => (int)$row['id'],
                'code'      => $row['code'],
                'comp_name' => $row['comp_name']
            );
        }
    }
    echo json_encode($outlets);
    exit;
}

if ($action === 'getActiveStaff' && $_request_method === 'GET') {
    $page    = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $perPage = 15;
    $offset  = ($page - 1) * $perPage;

    $count_result = mysqli_query($conn, "SELECT COUNT(*) as total FROM staff WHERE consult_call > 0 AND recycle != 1");
    $total = 0;
    if ($count_result) {
        $count_row = mysqli_fetch_assoc($count_result);
        $total = (int)$count_row['total'];
    }

    $query = "SELECT s.id, s.nama_staff, s.consult_call, s.status_semasa, s.outlet, d.depart_name,
                     cc.active_from, cc.active_to
              FROM staff s
              LEFT JOIN staff_department d ON s.department = d.id
              LEFT JOIN staff_cc cc ON cc.staff_id = s.id
              WHERE s.consult_call > 0 AND s.recycle != 1
              ORDER BY s.consult_call ASC, s.nama_staff ASC
              LIMIT $perPage OFFSET $offset";
    $result = mysqli_query($conn, $query);

    $staff = array();
    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $staff[] = array(
                'id'             => (int)$row['id'],
                'nama_staff'     => $row['nama_staff'],
                'consult_call'   => (int)$row['consult_call'],
                'status_semasa'  => $row['status_semasa'] ? $row['status_semasa'] : '-',
                'department_name'=> $row['depart_name'] ? $row['depart_name'] : '-',
                'outlet'         => $row['outlet'] ? $row['outlet'] : '',
                'active_from'    => $row['active_from'] ? $row['active_from'] : '',
                'active_to'      => $row['active_to'] ? $row['active_to'] : ''
            );
        }
    }

    echo json_encode(array(
        'success'     => true,
        'data'        => $staff,
        'total'       => $total,
        'page'        => $page,
        'per_page'    => $perPage,
        'total_pages' => (int)ceil($total / $perPage)
    ));
    exit;
}

if ($action === 'searchStaff' && $_request_method === 'POST') {
    $search_term = isset($_POST['search_term']) ? mysqli_real_escape_string($conn, trim($_POST['search_term'])) : '';

    if ($search_term === '') {
        echo json_encode(array());
        exit;
    }

    $query = "SELECT s.id, s.nama_staff, s.consult_call, s.status_semasa, s.outlet, d.depart_name,
                     cc.active_from, cc.active_to
              FROM staff s
              LEFT JOIN staff_department d ON s.department = d.id
              LEFT JOIN staff_cc cc ON cc.staff_id = s.id
              WHERE s.nama_staff LIKE '%$search_term%'
              AND s.recycle != 1
              ORDER BY s.nama_staff ASC
              LIMIT 20";
    $result = mysqli_query($conn, $query);

    $staff = array();
    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $staff[] = array(
                'id'              => (int)$row['id'],
                'nama_staff'      => $row['nama_staff'],
                'department_name' => $row['depart_name'] ? $row['depart_name'] : '-',
                'status_semasa'   => $row['status_semasa'] ? $row['status_semasa'] : '-',
                'consult_call'    => (int)$row['consult_call'],
                'outlet'          => $row['outlet'] ? $row['outlet'] : '',
                'active_from'     => $row['active_from'] ? $row['active_from'] : '',
                'active_to'       => $row['active_to'] ? $row['active_to'] : ''
            );
        }
    }

    echo json_encode($staff);
    exit;
}

if ($action === 'updateAccess' && $_request_method === 'POST') {
    $target_id  = isset($_POST['staff_id'])   ? (int)$_POST['staff_id']   : 0;
    $permission = isset($_POST['permission']) ? (int)$_POST['permission'] : -1;

    $valid_permissions = array(0, 1, 2, 3, 4, 5, 6);

    if ($target_id <= 0 || !in_array($permission, $valid_permissions)) {
        echo json_encode(array('success' => false, 'message' => 'Invalid input.'));
        exit;
    }

    if (!$is_full_super_admin) {
        if ($permission === 1 || $permission === 6) {
            echo json_encode(array('success' => false, 'message' => 'Only Super Admin can assign the Super Admin or Admin role.'));
            exit;
        }
        $target_query = mysqli_query($conn, "SELECT consult_call FROM staff WHERE id = $target_id AND recycle != 1");
        $target_row   = $target_query ? mysqli_fetch_assoc($target_query) : false;
        if (!$target_row) {
            echo json_encode(array('success' => false, 'message' => 'Staff not found.'));
            exit;
        }
        if ((int)$target_row['consult_call'] === 1) {
            echo json_encode(array('success' => false, 'message' => 'You are not allowed to edit a Super Admin.'));
            exit;
        }
    }

    $outlet_str = '';
    if (isset($_POST['outlet_ids']) && $_POST['outlet_ids'] !== '') {
        $raw_ids = explode(',', $_POST['outlet_ids']);
        $clean_ids = array();
        foreach ($raw_ids as $oid) {
            $oid = (int)trim($oid);
            if ($oid > 0) {
                $clean_ids[] = $oid;
            }
        }
        $outlet_str = implode(',', $clean_ids);
    }

    $active_from = isset($_POST['active_from']) ? trim($_POST['active_from']) : '';
    $active_to   = isset($_POST['active_to'])   ? trim($_POST['active_to'])   : '';

    $date_re = '/^\d{4}-\d{2}-\d{2}$/';
    if ($active_from !== '' && !preg_match($date_re, $active_from)) {
        echo json_encode(array('success' => false, 'message' => 'Invalid active_from date.'));
        exit;
    }
    if ($active_to !== '' && !preg_match($date_re, $active_to)) {
        echo json_encode(array('success' => false, 'message' => 'Invalid active_to date.'));
        exit;
    }
    if ($active_from !== '' && $active_to !== '' && $active_from > $active_to) {
        echo json_encode(array('success' => false, 'message' => 'Active From cannot be after Active To.'));
        exit;
    }

    $outlet_str_escaped = mysqli_real_escape_string($conn, $outlet_str);
    $update = "UPDATE staff SET consult_call = $permission, outlet = '$outlet_str_escaped' WHERE id = $target_id AND recycle != 1";
    if (!mysqli_query($conn, $update)) {
        echo json_encode(array('success' => false, 'message' => 'Database error: ' . mysqli_error($conn)));
        exit;
    }

    // Timeline is optional: only keep a staff_cc row when both dates are filled.
    if ($active_from !== '' && $active_to !== '') {
        $from_escaped = mysqli_real_escape_string($conn, $active_from);
        $to_escaped   = mysqli_real_escape_string($conn, $active_to);
        $cc_upsert = "INSERT INTO staff_cc (staff_id, active_from, active_to)
                      VALUES ($target_id, '$from_escaped', '$to_escaped')
                      ON DUPLICATE KEY UPDATE active_from = '$from_escaped', active_to = '$to_escaped'";
        if (!mysqli_query($conn, $cc_upsert)) {
            echo json_encode(array('success' => false, 'message' => 'Database error: ' . mysqli_error($conn)));
            exit;
        }
    } else {
        mysqli_query($conn, "DELETE FROM staff_cc WHERE staff_id = $target_id");
    }

    echo json_encode(array('success' => true, 'message' => 'Access updated successfully.'));
    exit;
}

echo json_encode(array('error' => 'Unknown action'));
