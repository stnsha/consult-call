<?php
// Absolute base URL for the consultcall module's own pages/assets -- see
// navbar.php for the full explanation. Defined here too since this file is
// one level down (clinical_condition/) and its <head> link tag is output
// before navbar.php is included further down.
if (!defined('CONSULTCALL_BASE')) {
    define('CONSULTCALL_BASE', '/odb/' . basename(dirname(dirname(__FILE__))) . '/');
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>ConsultCall - Clinical Conditions</title>
    <base href="/odb/">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
    <link href="<?php echo CONSULTCALL_BASE; ?>css/style.css?v=<?php echo time(); ?>" rel="stylesheet">
</head>
<?php
require_once('../../lock_adv.php');
$connect = 1;
include('../../common/index_adv.php');

require_once __DIR__ . '/../roles.php';
// Roles from staff.consult_call (comma list), dev role override applied on localhost.
$consult_call_roles = resolveConsultCallRoles($conn, $id_user);

if (!$consult_call_roles) {
    header('Location: ' . CONSULTCALL_BASE . 'unauthorized.php');
    exit;
}

$can_toggle_condition_status = hasConsultCallRole($consult_call_roles, 1, 6);
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
            <div class="col-12">
                <h1 class="mb-1 fw-bold" style="font-size: 18px;text-align: left;">Clinical Conditions</h1>
                <p class="text-muted mb-0" style="font-size: 13px;text-align: left;">View and manage clinical condition definitions used for consult call eligibility.</p>
            </div>
        </div>

        <div class="bento-card">
            <div id="table-alert" class="alert alert-danger mb-3" role="alert" style="display:none; font-size: 13px;">
                <span id="table-alert-msg"></span>
            </div>

            <?php if ($can_toggle_condition_status): ?>
            <div id="bulk-actions-bar" class="alert alert-secondary d-none align-items-center justify-content-between mb-3 py-2" role="alert" style="font-size: 13px;">
                <span id="bulk-actions-count">0 selected</span>
                <div>
                    <button type="button" id="bulk-set-active-btn" class="btn btn-sm btn-outline-success me-1">Set Active</button>
                    <button type="button" id="bulk-set-inactive-btn" class="btn btn-sm btn-outline-danger">Set Inactive</button>
                </div>
            </div>
            <?php endif; ?>

            <div class="row g-2 mb-3">
                <div class="col-6">
                    <input type="text" id="filter-description" class="form-control form-control-sm" placeholder="Search description..." style="font-size: 13px;">
                </div>
                <div class="col-3">
                    <select id="filter-type" class="form-select form-select-sm" style="font-size: 13px;">
                        <option value="">All Types</option>
                        <option value="CC">CC</option>
                        <option value="AO">AO</option>
                        <option value="CC + AO">CC + AO</option>
                        <option value="__none__">- (no type)</option>
                    </select>
                </div>
                <div class="col-3">
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
                            <?php if ($can_toggle_condition_status): ?>
                            <th style="width: 30px;"><input type="checkbox" id="select-all-checkbox" title="Select all on this page"></th>
                            <?php endif; ?>
                            <th style="width: 40px;">#</th>
                            <th>Description</th>
                            <th style="width: 120px;">Type</th>
                            <th style="width: 100px;">Risk Tier</th>
                            <th style="width: 90px;">Status</th>
                            <th style="width: 110px;">Active From</th>
                            <th style="width: 160px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="conditions-tbody">
                        <tr>
                            <td colspan="8" class="text-center text-muted py-4">Loading...</td>
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

    <script>
    var CC_CONFIG = {
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        roles: <?php echo json_encode($consult_call_roles); ?>,
        baseUrl: <?php echo json_encode(CONSULTCALL_BASE); ?>,
        apiUrl: '<?php echo CONSULTCALL_BASE; ?>api-jwt.php',
        isSuperAdmin: <?php echo hasConsultCallRole($consult_call_roles, 1) ? 'true' : 'false'; ?>,
        canToggleStatus: <?php echo $can_toggle_condition_status ? 'true' : 'false'; ?>,
        colSpan: <?php echo $can_toggle_condition_status ? 8 : 7; ?>
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="<?php echo CONSULTCALL_BASE; ?>clinical_condition/js/index.js?v=<?php echo time(); ?>"></script>
</body>
</html>
