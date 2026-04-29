<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>ConsultCall - Update Clinical Condition</title>
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

if ($consult_call_permission !== 1) {
    header('Location: /odb/consultcall/clinical_condition/index.php');
    exit;
}

$condition_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$condition_id) {
    header('Location: /odb/consultcall/clinical_condition/index.php');
    exit;
}
?>
<body>
    <div class="header" style="position: relative;">
        <b class="rtop"><b class="r1"></b><b class="r2"></b><b class="r3"></b><b class="r4"></b></b>
        <h1 class="headerH1"><img src='common/img/consultcall.png' width='20px'> ConsultCall</h1>
        <b class="rbottom"><b class="r4"></b><b class="r3"></b><b class="r2"></b><b class="r1"></b></b>
    </div>
    <?php include('../navbar.php'); ?>
    <div class="consultcall-container mb-3">

        <div class="row mb-4">
            <div class="col-12">
                <div style="text-align: left;">
                    <a href="consultcall/clinical_condition/index.php" class="btn btn-outline-secondary btn-sm mb-3">
                        <i class="bi bi-arrow-left"></i> Back
                    </a>
                </div>
                <h1 class="mb-1 fw-bold" style="font-size: 18px; text-align: left;">Update Clinical Condition</h1>
                <p class="text-muted mb-0" style="font-size: 13px; text-align: left;">Condition ID: <span id="display-id">...</span></p>
            </div>
        </div>

        <div class="row">
            <div class="col-md-8 col-lg-6">
                <div class="bento-card">

                    <div id="form-alert" class="alert alert-dismissible fade show mb-3" role="alert" style="display:none; font-size: 13px;">
                        <span id="form-alert-msg"></span>
                        <button type="button" class="btn-close" onclick="document.getElementById('form-alert').style.display='none';"></button>
                    </div>

                    <div id="form-loading" class="text-center text-muted py-4" style="font-size: 13px;">
                        Loading condition data...
                    </div>

                    <form id="update-form" style="display:none;">

                        <div class="mb-3">
                            <label class="form-label" style="font-size: 13px; font-weight: 500;">Evaluator</label>
                            <div id="display-evaluator" style="font-size: 13px; text-align: left;">-</div>
                            <div class="form-text" style="font-size: 11px; text-align: left;">(system field - not editable)</div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label" style="font-size: 13px; font-weight: 500;">Criteria Count</label>
                            <div id="display-criteria-count" style="font-size: 13px; text-align: left;">-</div>
                            <div class="form-text" style="font-size: 11px; text-align: left;">(system field - not editable)</div>
                        </div>

                        <div class="mb-3">
                            <label for="field-description" class="form-label" style="font-size: 13px; font-weight: 500;">Description <span class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="field-description" name="description"
                                maxlength="500" required style="font-size: 13px;">
                        </div>

                        <div class="mb-4">
                            <label for="field-risk-tier" class="form-label" style="font-size: 13px; font-weight: 500;">Risk Tier <span class="text-danger">*</span></label>
                            <select class="form-select" id="field-risk-tier" name="risk_tier" style="font-size: 13px;">
                                <option value="0">0 — Healthy</option>
                                <option value="1">1 — Low</option>
                                <option value="2">2 — Medium</option>
                                <option value="3">3 — High</option>
                            </select>
                        </div>

                        <div class="d-flex justify-content-end gap-2">
                            <a href="consultcall/clinical_condition/index.php" class="btn btn-outline-secondary btn-sm">Cancel</a>
                            <button type="submit" class="btn btn-primary btn-sm" id="save-btn">Save Changes</button>
                        </div>

                    </form>
                </div>
            </div>
        </div>

    </div>

    <script>
    var CC_CONFIG = {
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        permission: <?php echo json_encode($consult_call_permission); ?>,
        apiUrl: 'consultcall/api-jwt.php',
        conditionId: <?php echo json_encode($condition_id); ?>
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="consultcall/clinical_condition/js/update.js?v=<?php echo time(); ?>"></script>
</body>
</html>
