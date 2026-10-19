<?php
date_default_timezone_set('Asia/Kuala_Lumpur');
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

require_once __DIR__ . '/roles.php';
// Roles from staff.consult_call (comma list), dev role override applied on localhost.
$consult_call_roles = resolveConsultCallRoles($conn, $id_user);

if (!$consult_call_roles) {
    header('Location: ' . CONSULTCALL_BASE . 'unauthorized.php');
    exit;
}

$doctor_list = array();
$doctor_query = "SELECT id, nama_staff FROM staff WHERE FIND_IN_SET('2', consult_call) AND recycle != 1 ORDER BY nama_staff";
$doctor_result = mysqli_query($conn, $doctor_query);
if ($doctor_result) {
    while ($doctor_row = mysqli_fetch_assoc($doctor_result)) {
        $doctor_list[] = $doctor_row;
    }
}

$outlet_list = array();
$outlet_query = "SELECT id, code, comp_name FROM outlet ORDER BY code ASC";
$outlet_result = mysqli_query($conn, $outlet_query);
if ($outlet_result) {
    while ($outlet_row = mysqli_fetch_assoc($outlet_result)) {
        $outlet_list[] = $outlet_row;
    }
}

// Default report range: first day of the current month to today (Asia/Kuala_Lumpur).
// Reset Filters returns to the same range via CC_CONFIG.defaultDateFrom/To.
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
                <p class="text-muted mb-0" style="font-size: 13px; text-align: left;">Enrollment and status analytics
                    for telehealth consultations</p>
            </div>
        </div>

        <!-- Filter Section -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-2">
                            <label for="rptDateFrom" class="form-label">Enrollment From</label>
                            <input type="date" class="form-control" id="rptDateFrom"
                                value="<?php echo htmlspecialchars($report_default_from); ?>">
                        </div>
                        <div class="col-md-2">
                            <label for="rptDateTo" class="form-label">Enrollment To</label>
                            <input type="date" class="form-control" id="rptDateTo"
                                value="<?php echo htmlspecialchars($report_default_to); ?>">
                        </div>
                        <div class="col-md-2">
                            <label for="rptOutletFilter" class="form-label">Outlet</label>
                            <select class="form-select" id="rptOutletFilter">
                                <option value="">All Outlets</option>
                                <?php foreach ($outlet_list as $outlet): ?>
                                <option value="<?php echo (int)$outlet['id']; ?>">
                                    <?php echo htmlspecialchars($outlet['code']); ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-4">
                            <label for="rptDoctorFilter" class="form-label">Doctor</label>
                            <select class="form-select" id="rptDoctorFilter">
                                <option value="">All Doctors</option>
                                <?php foreach ($doctor_list as $doctor): ?>
                                <option value="<?php echo (int)$doctor['id']; ?>">
                                    <?php echo htmlspecialchars($doctor['nama_staff']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-2 ms-auto d-flex gap-2">
                            <button type="button" class="btn btn-primary flex-fill" id="rptApplyBtn">
                                <i class="bi bi-funnel me-1"></i>Apply
                            </button>
                            <button type="button" class="btn btn-secondary flex-fill" id="rptResetBtn"
                                title="Reset Filters">
                                <i class="bi bi-x-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Monthly breakdown tables -->
        <div class="row mb-2">
            <div class="col-12">
                <h2 class="mb-0" style="font-size: 15px; font-weight: 600;">Enrollment Type Breakdown by Month</h2>
            </div>
        </div>
        <div class="row g-3 mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" id="enrollmentMonthlyTable">
                            <thead>
                                <tr id="enrollmentMonthlyTableHead">
                                    <th class="text-center">Type</th>
                                    <th class="text-center">Total</th>
                                </tr>
                            </thead>
                            <tbody id="enrollmentMonthlyTableBody">
                                <tr>
                                    <td colspan="2" class="text-center text-muted py-3">No data for the selected
                                        filters.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mb-2">
            <div class="col-12">
                <h2 class="mb-0" style="font-size: 15px; font-weight: 600;">Monthly Performance Summary</h2>
            </div>
        </div>
        <div class="row g-3 mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" id="monthlySummaryTable">
                            <thead>
                                <tr>
                                    <th class="text-center">Month</th>
                                    <th class="text-center">Total Consent Obtained</th>
                                    <th class="text-center">Total Consultations Completed</th>
                                    <th class="text-center">Total Referred Internally</th>
                                </tr>
                            </thead>
                            <tbody id="monthlySummaryTableBody">
                                <tr>
                                    <td colspan="4" class="text-center text-muted py-3">No data for the selected
                                        filters.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- A) Enrollment Data -->
        <div class="row mb-2">
            <div class="col-12">
                <h2 class="mb-0" style="font-size: 15px; font-weight: 600;">Enrollment Data</h2>
            </div>
        </div>
        <div class="row g-3 mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Enrollment Data / Time</h3>
                    <div class="chart-wrap"><canvas id="chartA1"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Enrollment Data by Outlets by Month (Top 5)</h3>
                    <div class="chart-wrap"><canvas id="chartA3"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Enrollment Data by Doctors by Month (Top 5)</h3>
                    <div class="chart-wrap"><canvas id="chartA4"></canvas></div>
                </div>
            </div>
        </div>

        <!-- B) Status Data -->
        <div class="row mb-2">
            <div class="col-12">
                <h2 class="mb-0" style="font-size: 15px; font-weight: 600;">Status Data</h2>
            </div>
        </div>
        <div class="row g-3 mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Answered Call by Month</h3>
                    <div class="chart-wrap"><canvas id="chartAnsweredCall"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Consent Status by Month</h3>
                    <div class="chart-wrap"><canvas id="chartB1"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Non-Eligibility Reasons by Month</h3>
                    <div class="chart-wrap"><canvas id="chartB2"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Add-On Status by Month</h3>
                    <div class="chart-wrap"><canvas id="chartB3"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Consult Calls per Add On</h3>
                    <div id="chartAddOnUsageEmpty" class="text-center text-muted py-4" style="display:none; font-size: 13px;">
                        No add-ons recommended for the selected filters.
                    </div>
                    <div class="chart-wrap" id="chartAddOnUsageWrap"><canvas id="chartAddOnUsage"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Advise Type Breakdown by Month</h3>
                    <div class="chart-wrap"><canvas id="chartB4"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Consultation Status by Month (New Case vs Follow-up)</h3>
                    <div class="chart-wrap"><canvas id="chartB5"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Process Status by Month</h3>
                    <div class="chart-wrap"><canvas id="chartB6"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Consultation Outcome by Month</h3>
                    <div class="chart-wrap"><canvas id="chartB7"></canvas></div>
                </div>
            </div>
            <div class="col-12">
                <div class="bento-card">
                    <h3 class="chart-title">Action by Month</h3>
                    <div class="chart-wrap"><canvas id="chartActionMaster"></canvas></div>
                </div>
            </div>
        </div>

    </div><!-- /.consultcall-container -->

    <script>
    var CC_CONFIG = {
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        roles: <?php echo json_encode($consult_call_roles); ?>,
        baseUrl: <?php echo json_encode(CONSULTCALL_BASE); ?>,
        apiUrl: '<?php echo CONSULTCALL_BASE; ?>api-jwt.php',
        defaultDateFrom: <?php echo json_encode($report_default_from); ?>,
        defaultDateTo: <?php echo json_encode($report_default_to); ?>
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2/dist/chartjs-plugin-datalabels.min.js">
    </script>
    <script src="<?php echo CONSULTCALL_BASE; ?>js/report.js?v=<?php echo time(); ?>"></script>
</body>

</html>