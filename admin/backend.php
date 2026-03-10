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

// Verify requester is Super Admin using session username
$username   = mysqli_real_escape_string($conn, $_SESSION['myusername']);
$auth_query = "SELECT id, consult_call FROM staff WHERE username = '$username' AND recycle != 1";
$auth_result = mysqli_query($conn, $auth_query);
if (!$auth_result || mysqli_num_rows($auth_result) === 0) {
    echo json_encode(array('error' => 'Unauthorized'));
    exit;
}
$auth_row = mysqli_fetch_assoc($auth_result);
if ((int)$auth_row['consult_call'] !== 1) {
    echo json_encode(array('error' => 'Unauthorized'));
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

if ($action === 'getActiveStaff' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $page    = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $perPage = 15;
    $offset  = ($page - 1) * $perPage;

    $count_result = mysqli_query($conn, "SELECT COUNT(*) as total FROM staff WHERE consult_call > 0 AND recycle != 1");
    $total = 0;
    if ($count_result) {
        $count_row = mysqli_fetch_assoc($count_result);
        $total = (int)$count_row['total'];
    }

    $query = "SELECT s.id, s.nama_staff, s.consult_call, s.status_semasa, d.depart_name
              FROM staff s
              LEFT JOIN staff_department d ON s.department = d.id
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
                'department_name'=> $row['depart_name'] ? $row['depart_name'] : '-'
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

if ($action === 'searchStaff' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $search_term = isset($_POST['search_term']) ? mysqli_real_escape_string($conn, trim($_POST['search_term'])) : '';

    if ($search_term === '') {
        echo json_encode(array());
        exit;
    }

    $query = "SELECT s.id, s.nama_staff, s.consult_call, s.status_semasa, d.depart_name
              FROM staff s
              LEFT JOIN staff_department d ON s.department = d.id
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
                'consult_call'    => (int)$row['consult_call']
            );
        }
    }

    echo json_encode($staff);
    exit;
}

if ($action === 'updateAccess' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $target_id = isset($_POST['staff_id'])   ? (int)$_POST['staff_id']   : 0;
    $permission = isset($_POST['permission']) ? (int)$_POST['permission'] : -1;

    $valid_permissions = array(0, 1, 2, 3, 4, 5);

    if ($target_id <= 0 || !in_array($permission, $valid_permissions)) {
        echo json_encode(array('success' => false, 'message' => 'Invalid input.'));
        exit;
    }

    $update = "UPDATE staff SET consult_call = $permission WHERE id = $target_id AND recycle != 1";
    if (mysqli_query($conn, $update)) {
        echo json_encode(array('success' => true, 'message' => 'Access updated successfully.'));
    } else {
        echo json_encode(array('success' => false, 'message' => 'Database error: ' . mysqli_error($conn)));
    }
    exit;
}

echo json_encode(array('error' => 'Unknown action'));
