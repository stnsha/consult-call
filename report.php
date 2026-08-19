<?php
// Absolute base URL for this module's own pages/assets -- see navbar.php for
// the full explanation. Defined here too since this link tag in <head> is
// output before navbar.php is included further down.
if (!defined('CONSULTCALL_BASE')) {
    define('CONSULTCALL_BASE', '/odb/' . basename(dirname(__FILE__)) . '/');
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
    <title>Consult Call Report</title>
    <base href="/odb/">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
    <link href="<?php echo CONSULTCALL_BASE; ?>css/style.css?v=<?php echo time(); ?>" rel="stylesheet">
</head>
<?php
require_once('../lock_adv.php');
$connect = 1;
include('../common/index_adv.php');

$consult_call_permission = 0;
$cc_query = "SELECT consult_call FROM staff WHERE id = '" . mysqli_real_escape_string($conn, $id_user) . "'";
$cc_result = mysqli_query($conn, $cc_query);
if ($cc_result && mysqli_num_rows($cc_result) > 0) {
    $cc_row = mysqli_fetch_assoc($cc_result);
    $consult_call_permission = isset($cc_row['consult_call']) ? (int)$cc_row['consult_call'] : 0;
}

// Apply dev role override on localhost (mirrors api-jwt.php behaviour)
$_rpt_server_name = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '';
$_rpt_http_host   = isset($_SERVER['HTTP_HOST'])   ? $_SERVER['HTTP_HOST']   : '';
$_rpt_is_local    = in_array($_rpt_server_name, array('localhost', '127.0.0.1'))
    || strpos($_rpt_http_host, 'localhost') !== false
    || strpos($_rpt_http_host, '127.0.0.1') !== false;
if ($_rpt_is_local && isset($_SESSION['dev_role_override'])) {
    $consult_call_permission = (int)$_SESSION['dev_role_override'];
}

if ($consult_call_permission === 0) {
    header('Location: ' . CONSULTCALL_BASE . 'unauthorized.php');
    exit;
}

$doctor_list = array();
$doctor_query = "SELECT id, nama_staff FROM staff WHERE consult_call = 2 AND recycle != 1 ORDER BY nama_staff";
$doctor_result = mysqli_query($conn, $doctor_query);
if ($doctor_result) {
    while ($doctor_row = mysqli_fetch_assoc($doctor_result)) {
        $doctor_list[] = $doctor_row;
    }
}

$outlet_list = array();
$outlet_query = "SELECT id, code, comp_name FROM outlet ORDER BY comp_name";
$outlet_result = mysqli_query($conn, $outlet_query);
if ($outlet_result) {
    while ($outlet_row = mysqli_fetch_assoc($outlet_result)) {
        $outlet_list[] = $outlet_row;
    }
}

// Default report range: current calendar month
$report_default_from = date('Y-m-01');
$report_default_to   = date('Y-m-d');
?>

<body>
    <?php include('navbar.php'); ?>
    <div class="header" style="position: relative;">
        <b class="rtop"><b class="r1"></b><b class="r2"></b><b class="r3"></b><b class="r4"></b></b>
        <h1 class="headerH1"><img src='common/img/consultcall.png' width='20px'> ConsultCall</h1>
        <b class="rbottom"><b class="r4"></b><b class="r3"></b><b class="r2"></b><b class="r1"></b></b>
    </div>
    <div class="consultcall-container mb-3">

        <div class="row mb-4">
            <div class="col-12">
                <h1 class="mb-1 fw-bold" style="font-size: 18px; font-weight: 500; text-align: left;">Dashboard</h1>
                <p class="text-muted mb-0" style="font-size: 13px; text-align: left;">Enrollment and status analytics for telehealth consultations</p>
            </div>
        </div>

        <!-- Filter Section -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-2">
                            <label for="rptDateFrom" class="form-label">Enrollment From</label>
                            <input type="date" class="form-control" id="rptDateFrom" value="<?php echo htmlspecialchars($report_default_from); ?>">
                        </div>
                        <div class="col-md-2">
                            <label for="rptDateTo" class="form-label">Enrollment To</label>
                            <input type="date" class="form-control" id="rptDateTo" value="<?php echo htmlspecialchars($report_default_to); ?>">
                        </div>
                        <div class="col-md-2">
                            <label for="rptOutletFilter" class="form-label">Outlet</label>
                            <select class="form-select" id="rptOutletFilter">
                                <option value="">All Outlets</option>
                                <?php foreach ($outlet_list as $outlet): ?>
                                    <option value="<?php echo (int)$outlet['id']; ?>"><?php echo htmlspecialchars($outlet['code'] . ' - ' . $outlet['comp_name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="rptDoctorFilter" class="form-label">Doctor</label>
                            <select class="form-select" id="rptDoctorFilter">
                                <option value="">All Doctors</option>
                                <?php foreach ($doctor_list as $doctor): ?>
                                    <option value="<?php echo (int)$doctor['id']; ?>"><?php echo htmlspecialchars($doctor['nama_staff']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="rptPeriodToggle" class="form-label">Enrollment Trend By</label>
                            <select class="form-select" id="rptPeriodToggle">
                                <option value="day">Day</option>
                                <option value="week">Weekly</option>
                                <option value="month" selected>Monthly</option>
                                <option value="year">Year</option>
                            </select>
                        </div>
                        <div class="col-md-2 d-flex gap-2">
                            <button type="button" class="btn btn-primary flex-fill" id="rptApplyBtn">
                                <i class="bi bi-funnel me-1"></i>Apply
                            </button>
                            <button type="button" class="btn btn-secondary flex-fill" id="rptResetBtn" title="Reset Filters">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- A) Enrollment Data -->
        <div class="row mb-2">
            <div class="col-12">
                <h2 class="mb-0" style="font-size: 15px; font-weight: 600;">A) Enrollment Data</h2>
            </div>
        </div>
        <div class="row g-3 mb-4">
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">1) Enrollment Data / Time</h3>
                    <div class="chart-wrap"><canvas id="chartA1"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">2) Enrollment Type</h3>
                    <div class="chart-wrap"><canvas id="chartA2"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">3) Enrollment Data by Outlets</h3>
                    <div class="chart-wrap"><canvas id="chartA3"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">4) Enrollment Data by Doctors</h3>
                    <div class="chart-wrap"><canvas id="chartA4"></canvas></div>
                </div>
            </div>
        </div>

        <!-- B) Status Data -->
        <div class="row mb-2">
            <div class="col-12">
                <h2 class="mb-0" style="font-size: 15px; font-weight: 600;">B) Status Data</h2>
            </div>
        </div>
        <div class="row g-3 mb-4">
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">1) Consent Status</h3>
                    <div class="chart-wrap"><canvas id="chartB1"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">2) Non-Eligibility Reasons</h3>
                    <div class="chart-wrap"><canvas id="chartB2"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">3) Add-On Status</h3>
                    <div class="chart-wrap"><canvas id="chartB3"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">4) Tests Added</h3>
                    <div class="chart-wrap"><canvas id="chartB4"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">5) Consultation Status (New Case vs Follow-up)</h3>
                    <div class="chart-wrap"><canvas id="chartB5"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">6) Process Status</h3>
                    <div class="chart-wrap"><canvas id="chartB6"></canvas></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card">
                    <h3 class="chart-title">7) Mode of Action</h3>
                    <div class="chart-wrap"><canvas id="chartB7"></canvas></div>
                </div>
            </div>
        </div>
    </div><!-- /.consultcall-container -->

    <script>
        var CC_CONFIG = {
            staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
            permission: <?php echo json_encode($consult_call_permission); ?>,
            baseUrl: <?php echo json_encode(CONSULTCALL_BASE); ?>,
            apiUrl: '<?php echo CONSULTCALL_BASE; ?>api-jwt.php'
        };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
    <script src="<?php echo CONSULTCALL_BASE; ?>js/report.js?v=<?php echo time(); ?>"></script>
</body>

</html>
