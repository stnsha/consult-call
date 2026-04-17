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
    <link href="consultcall/css/style.css?v=<?php echo time(); ?>" rel="stylesheet">
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

$doctor_list = array();
$doctor_query = "SELECT id, nama_staff FROM staff WHERE consult_call = 2 AND recycle != 1 ORDER BY nama_staff";
$doctor_result = mysqli_query($conn, $doctor_query);
if ($doctor_result) {
    while ($doctor_row = mysqli_fetch_assoc($doctor_result)) {
        $doctor_list[] = $doctor_row;
    }
}
?>
<body>
    
    <div class="header" style="position: relative;">
        <b class="rtop"><b class="r1"></b><b class="r2"></b><b class="r3"></b><b class="r4"></b></b>
        <h1 class="headerH1"><img src='common/img/consultcall.png' width='20px'> ConsultCall Report</h1>
        <b class="rbottom"><b class="r4"></b><b class="r3"></b><b class="r2"></b><b class="r1"></b></b>
    </div>
    <?php include('navbar.php'); ?>
    <div class="consultcall-container mb-3">


        <!-- Filter Bar -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-2 col-sm-6">
                            <label for="dateFrom" class="form-label">Enrollment From</label>
                            <input type="date" class="form-control" id="dateFrom">
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label for="dateTo" class="form-label">Enrollment To</label>
                            <input type="date" class="form-control" id="dateTo">
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label for="consentFilter" class="form-label">Consent Status</label>
                            <select class="form-select" id="consentFilter">
                                <option value="">All</option>
                                <option value="0">Pending</option>
                                <option value="1">Obtained</option>
                                <option value="2">Refused</option>
                                <option value="3">On Medication</option>
                            </select>
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label for="processFilter" class="form-label">Process Status</label>
                            <select class="form-select" id="processFilter">
                                <option value="">All</option>
                                <option value="1">Active</option>
                                <option value="2">Escalated</option>
                                <option value="3">Closed</option>
                            </select>
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label for="enrollmentFilter" class="form-label">Enrollment Type</label>
                            <select class="form-select" id="enrollmentFilter">
                                <option value="">All</option>
                                <option value="1">Primary</option>
                                <option value="2">Follow-up</option>
                            </select>
                        </div>
                        <div class="col-md-2 col-sm-6">
                            <label for="consultedByFilter" class="form-label">Consulted By</label>
                            <select class="form-select" id="consultedByFilter">
                                <option value="">All</option>
                                <?php foreach ($doctor_list as $doctor): ?>
                                <option value="<?php echo (int)$doctor['id']; ?>"><?php echo htmlspecialchars($doctor['nama_staff']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <div class="d-flex gap-2 mt-3 pt-3 align-items-center" style="border-top: 1px solid #f1f3f4;">
                        <button type="button" class="btn btn-primary btn-sm" id="applyBtn">
                            <i class="bi bi-funnel me-1"></i>Apply Filter
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" id="resetBtn">
                            <i class="bi bi-x-lg me-1"></i>Reset
                        </button>
                        <div class="ms-auto d-flex align-items-center gap-2">
                            <span id="report-record-badge" class="badge bg-primary" style="font-size: 12px; display: none;"><span id="report-total-badge">0</span> records</span>
                            <button type="button" class="btn btn-success btn-sm" id="exportBtn">
                                <i class="bi bi-download me-1"></i>Export CSV
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Summary Cards -->
        <div class="row g-4 mb-4">
            <div class="col-md-3">
                <div class="bento-card h-100" style="border-top: 3px solid #0d6efd;">
                    <div class="d-flex align-items-center">
                        <div class="card-icon bg-primary bg-opacity-10 text-primary">
                            <i class="bi bi-people"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Total Records</h6>
                            <h2 class="card-value mb-0"><span id="report-total">--</span></h2>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="bento-card h-100" style="border-top: 3px solid #ffc107;">
                    <div class="d-flex align-items-center mb-2">
                        <div class="card-icon bg-warning bg-opacity-10 text-warning">
                            <i class="bi bi-funnel"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-0">Active Filter</h6>
                        </div>
                    </div>
                    <p class="mb-0 text-muted" id="report-filter-desc" style="font-size: 13px; padding-left: 4px;">All records (no filter applied)</p>
                </div>
            </div>
            <div class="col-md-3">
                <div class="bento-card h-100" style="border-top: 3px solid #198754;">
                    <div class="d-flex align-items-center mb-2">
                        <div class="card-icon bg-success bg-opacity-10 text-success">
                            <i class="bi bi-clock"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-0">Generated At</h6>
                        </div>
                    </div>
                    <p class="mb-0 text-muted" id="report-generated" style="font-size: 13px; padding-left: 4px;">--</p>
                </div>
            </div>
        </div>

        <!-- Loading State -->
        <div id="loadingOverlay" style="display: flex; align-items: center; justify-content: center; padding: 60px 0;">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="ms-3 text-muted" style="font-size: 14px;">Loading report data...</span>
        </div>

        <!-- Report Content -->
        <div id="reportContent" style="display: none;">

            <!-- Outlet Enrollment (full width) -->
            <div class="row g-4 mb-4">
                <div class="col-12">
                    <div class="bento-card report-chart-card">
                        <h6 class="card-subtitle text-muted mb-3">Enrollment by Outlet</h6>
                        <div id="chart-outlets-container" style="position: relative; height: 300px;">
                            <canvas id="chart-outlets"></canvas>
                        </div>
                        <div id="chart-outlets-empty" class="text-center text-muted py-4 small" style="display: none;">
                            No outlet data available
                        </div>
                    </div>
                </div>
            </div>


            <!-- Row 1: Enrollment Type | Consent Status | Scheduled Status -->
            <div class="row g-4 mb-4">
                <div class="col-md-4">
                    <div class="bento-card h-100 report-chart-card">
                        <h6 class="card-subtitle text-muted mb-3">Enrollment Type</h6>
                        <div style="position: relative; height: 220px;">
                            <canvas id="chart-enrollment"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="bento-card h-100 report-chart-card">
                        <h6 class="card-subtitle text-muted mb-3">Consent Status</h6>
                        <div style="position: relative; height: 220px;">
                            <canvas id="chart-consent"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="bento-card h-100 report-chart-card">
                        <h6 class="card-subtitle text-muted mb-3">Scheduled Status</h6>
                        <div style="position: relative; height: 220px;">
                            <canvas id="chart-scheduled"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Row 2: Mode of Consultation | Process Status | Consult Status -->
            <div class="row g-4 mb-4">
                <div class="col-md-4">
                    <div class="bento-card h-100 report-chart-card">
                        <h6 class="card-subtitle text-muted mb-3">Mode of Consultation</h6>
                        <div style="position: relative; height: 220px;">
                            <canvas id="chart-mode-consult"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="bento-card h-100 report-chart-card">
                        <h6 class="card-subtitle text-muted mb-3">Process Status <span class="text-muted fw-normal" style="font-size:10px;">(latest detail)</span></h6>
                        <div style="position: relative; height: 220px;">
                            <canvas id="chart-process"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="bento-card h-100 report-chart-card">
                        <h6 class="card-subtitle text-muted mb-3">Consult Status <span class="text-muted fw-normal" style="font-size:10px;">(latest detail)</span></h6>
                        <div style="position: relative; height: 220px;">
                            <canvas id="chart-consult-status"></canvas>
                        </div>
                    </div>
                </div>
            </div>

        </div><!-- /#reportContent -->

    </div><!-- /.consultcall-container -->

    <script>
    var REPORT_CONFIG = {
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        permission: <?php echo json_encode($consult_call_permission); ?>,
        apiUrl: 'consultcall/api-jwt.php'
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="consultcall/js/report.js?v=<?php echo time(); ?>"></script>
</body>
</html>
