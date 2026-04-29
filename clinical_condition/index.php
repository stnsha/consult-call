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
$_cc_server_name = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '';
$_cc_http_host   = isset($_SERVER['HTTP_HOST'])   ? $_SERVER['HTTP_HOST']   : '';
$_cc_is_local    = in_array($_cc_server_name, array('localhost', '127.0.0.1'))
    || strpos($_cc_http_host, 'localhost') !== false
    || strpos($_cc_http_host, '127.0.0.1') !== false;
if ($_cc_is_local && isset($_SESSION['dev_role_override'])) {
    $consult_call_permission = (int)$_SESSION['dev_role_override'];
}
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

            <div class="table-responsive">
                <table class="table table-hover mb-0" style="font-size: 13px;">
                    <thead>
                        <tr>
                            <th style="width: 40px;">#</th>
                            <th>Description</th>
                            <th style="width: 100px;">Risk Tier</th>
                            <th style="width: 90px;">Status</th>
                            <th style="width: 160px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="conditions-tbody">
                        <tr>
                            <td colspan="5" class="text-center text-muted py-4">Loading...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

    </div>

    <script>
    var CC_CONFIG = {
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        permission: <?php echo json_encode($consult_call_permission); ?>,
        apiUrl: 'consultcall/api-jwt.php',
        isSuperAdmin: <?php echo $consult_call_permission === 1 ? 'true' : 'false'; ?>,
        colSpan: 5
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="consultcall/clinical_condition/js/index.js?v=<?php echo time(); ?>"></script>
</body>
</html>
