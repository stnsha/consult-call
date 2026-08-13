<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>ConsultCall - Add Ons</title>
    <base href="/odb/">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
    <link href="consultcall/css/style.css?v=<?php echo time(); ?>" rel="stylesheet">
</head>
<?php
require_once('../../lock_adv.php');
$connect = 1;
include('../../common/index_adv.php');

$consult_call_permission = 0;
$cc_query = "SELECT consult_call FROM staff WHERE id = '" . mysqli_real_escape_string($conn, $id_user) . "'";
$cc_result = mysqli_query($conn, $cc_query);
if ($cc_result && mysqli_num_rows($cc_result) > 0) {
    $cc_row = mysqli_fetch_assoc($cc_result);
    $consult_call_permission = isset($cc_row['consult_call']) ? (int)$cc_row['consult_call'] : 0;
}

// Apply dev role override on localhost (mirrors api-jwt.php behaviour)
$_ao_server_name = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '';
$_ao_http_host   = isset($_SERVER['HTTP_HOST'])   ? $_SERVER['HTTP_HOST']   : '';
$_ao_is_local    = in_array($_ao_server_name, array('localhost', '127.0.0.1'))
    || strpos($_ao_http_host, 'localhost') !== false
    || strpos($_ao_http_host, '127.0.0.1') !== false;
if ($_ao_is_local && isset($_SESSION['dev_role_override'])) {
    $consult_call_permission = (int)$_SESSION['dev_role_override'];
}

if ($consult_call_permission === 0) {
    header('Location: /odb/consultcall/unauthorized.php');
    exit;
}

// Same permission model as Clinical Conditions: Super Admin, Admin, and hardcoded staff 5138
$can_manage_add_ons = ($consult_call_permission === 1)
    || ($consult_call_permission === 6)
    || ((int)$id_user === 5138);
?>
<body>
    <?php include('../navbar.php'); ?>
    <div class="header" style="position: relative;">
        <b class="rtop"><b class="r1"></b><b class="r2"></b><b class="r3"></b><b class="r4"></b></b>
        <h1 class="headerH1"><img src='common/img/consultcall.png' width='20px'> ConsultCall</h1>
        <b class="rbottom"><b class="r4"></b><b class="r3"></b><b class="r2"></b><b class="r1"></b></b>
    </div>
    <div class="consultcall-container mb-3">

        <div class="row mb-4">
            <div class="col-12 d-flex justify-content-between align-items-start flex-wrap gap-2">
                <div>
                    <h1 class="mb-1 fw-bold" style="font-size: 18px;text-align: left;">Add Ons</h1>
                    <p class="text-muted mb-0" style="font-size: 13px;text-align: left;">View and manage the recommended add-ons list used in ConsultCall Eligibility.</p>
                </div>
                <?php if ($can_manage_add_ons): ?>
                <button type="button" id="add-new-btn" class="btn btn-sm btn-primary">
                    <i class="bi bi-plus-lg me-1"></i>Add New Add On
                </button>
                <?php endif; ?>
            </div>
        </div>

        <div class="bento-card">
            <div id="table-alert" class="alert alert-danger mb-3" role="alert" style="display:none; font-size: 13px;">
                <span id="table-alert-msg"></span>
            </div>

            <div class="row g-2 mb-3">
                <div class="col-8">
                    <input type="text" id="filter-name" class="form-control form-control-sm" placeholder="Search name..." style="font-size: 13px;">
                </div>
                <div class="col-4">
                    <select id="filter-status" class="form-select form-select-sm" style="font-size: 13px;">
                        <option value="">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            <div class="table-responsive">
                <table class="table table-hover mb-0" style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Name</th>
                            <th style="width: 90px;">Status</th>
                            <th style="width: 160px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="add-ons-tbody">
                        <tr>
                            <td colspan="4" class="text-center text-muted py-4">Loading...</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <span id="paginationInfo" style="font-size: 13px;">Showing 0 to 0 of 0 entries</span>
                <nav>
                    <ul class="pagination pagination-sm mb-0" id="paginationControls"></ul>
                </nav>
            </div>
        </div>

    </div>

    <!-- Add / Edit modal -->
    <div class="modal fade" id="add-on-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form id="add-on-form">
                    <div class="modal-header">
                        <h5 class="modal-title" id="add-on-modal-title" style="font-size: 15px;">Add New Add On</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="modal-alert" class="alert alert-danger" role="alert" style="display:none; font-size: 13px;"></div>
                        <input type="hidden" id="add-on-id" value="">
                        <div class="mb-3">
                            <label for="add-on-name" class="form-label" style="font-size: 13px; font-weight: 500;">Name <span class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="add-on-name" maxlength="255" required style="font-size: 13px;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary btn-sm" id="add-on-save-btn">Save</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
    var AO_CONFIG = {
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        permission: <?php echo json_encode($consult_call_permission); ?>,
        apiUrl: 'consultcall/api-jwt.php',
        canManage: <?php echo $can_manage_add_ons ? 'true' : 'false'; ?>,
        colSpan: 4
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="consultcall/add_ons/js/index.js?v=<?php echo time(); ?>"></script>
</body>
</html>
