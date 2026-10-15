<?php
// Absolute base URL for the consultcall module's own pages/assets -- see
// navbar.php for the full explanation. Defined here too since this file is
// one level down (action_master/) and its <head> link tag is output before
// navbar.php is included further down.
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
    <title>ConsultCall - Actions</title>
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

// Actions maintenance is visible to Super Admin (1) and Admin (6) only (same as Add Ons).
if (!hasConsultCallRole($consult_call_roles, 1, 6)) {
    header('Location: ' . CONSULTCALL_BASE . 'unauthorized.php');
    exit;
}

$can_manage_actions = hasConsultCallRole($consult_call_roles, 1, 6);
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
                    <h1 class="mb-1 fw-bold" style="font-size: 18px;text-align: left;">Actions</h1>
                    <p class="text-muted mb-0" style="font-size: 13px;text-align: left;">View and manage the Action options used in Consultation Details.</p>
                </div>
                <?php if ($can_manage_actions): ?>
                <button type="button" id="add-new-btn" class="btn btn-sm btn-primary">
                    <i class="bi bi-plus-lg me-1"></i>Add New Action
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
                    <tbody id="actions-tbody">
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
    <div class="modal fade" id="action-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <form id="action-form">
                    <div class="modal-header">
                        <h5 class="modal-title" id="action-modal-title" style="font-size: 15px;">Add New Action</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="modal-alert" class="alert alert-danger" role="alert" style="display:none; font-size: 13px;"></div>
                        <input type="hidden" id="action-id" value="">
                        <div class="mb-3">
                            <label for="action-name" class="form-label" style="font-size: 13px; font-weight: 500;">Name <span class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="action-name" maxlength="255" required style="font-size: 13px;">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-primary btn-sm" id="action-save-btn">Save</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
    var AM_CONFIG = {
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        roles: <?php echo json_encode($consult_call_roles); ?>,
        baseUrl: <?php echo json_encode(CONSULTCALL_BASE); ?>,
        apiUrl: '<?php echo CONSULTCALL_BASE; ?>api-jwt.php',
        canManage: <?php echo $can_manage_actions ? 'true' : 'false'; ?>,
        colSpan: 4
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="<?php echo CONSULTCALL_BASE; ?>action_master/js/index.js?v=<?php echo time(); ?>"></script>
</body>
</html>
