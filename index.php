<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>Telehealth Consultation Dashboard</title>
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
        <h1 class="headerH1"><img src='common/img/consultcall.png' width='20px'> ConsultCall Dashboard</h1>
        <b class="rbottom"><b class="r4"></b><b class="r3"></b><b class="r2"></b><b class="r1"></b></b>
    </div>
    <?php include('navbar.php'); ?>
    <div class="consultcall-container mb-3">

        <!-- <div class="row mb-4">
            <div class="col-12">
                <h1 class="mb-1 fw-bold" style="font-size: 18px; font-weight: 500; text-align: left;">ConsultCall Dashboard</h1>
                <p class="text-muted mb-0" style="font-size: 13px; text-align: left;">Track and manage telehealth patient consultations</p>
            </div>
        </div> -->

        <!-- Row 1: Overview Cards -->
        <div class="row g-4 mb-4">
            <!-- Total Patients Card -->
            <div class="col-md-4">
                <div class="bento-card h-100">
                    <div class="d-flex align-items-center mb-3">
                        <div class="card-icon bg-primary bg-opacity-10 text-primary">
                            <i class="bi bi-people"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Total Patients</h6>
                            <h2 class="card-value mb-0"><span id="summary-total">--</span></h2>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="enrollmentFilter" data-filter-value="1">
                        <span class="status-label">Primary</span>
                        <span class="status-value" id="summary-enrollment-primary">--</span>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="enrollmentFilter" data-filter-value="2">
                        <span class="status-label">Follow-up</span>
                        <span class="status-value" id="summary-enrollment-followup">--</span>
                    </div>
                </div>
            </div>
            <!-- Consent Status Card -->
            <div class="col-md-4">
                <div class="bento-card h-100">
                    <div class="d-flex align-items-center mb-3">
                        <div class="card-icon bg-success bg-opacity-10 text-success">
                            <i class="bi bi-clipboard-check"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Consent Status</h6>
                            <h2 class="card-value mb-0"><span id="summary-consent-total">--</span></h2>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="consentFilter" data-filter-value="0">
                        <span class="status-label">Pending</span>
                        <span class="status-value" id="summary-consent-pending">--</span>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="consentFilter" data-filter-value="1">
                        <span class="status-label">Obtained</span>
                        <span class="status-value" id="summary-consent-obtained">--</span>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="consentFilter" data-filter-value="2">
                        <span class="status-label">Refused</span>
                        <span class="status-value" id="summary-consent-refused">--</span>
                    </div>
                </div>
            </div>
            <!-- Process Status Card -->
            <div class="col-md-4">
                <div class="bento-card h-100">
                    <div class="d-flex align-items-center mb-3">
                        <div class="card-icon bg-info bg-opacity-10 text-info">
                            <i class="bi bi-gear"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Process Status</h6>
                            <h2 class="card-value mb-0"><span id="summary-process-total">--</span></h2>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="processFilter" data-filter-value="1">
                        <span class="status-label">Active</span>
                        <span class="status-value" id="summary-process-active">--</span>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="processFilter" data-filter-value="3">
                        <span class="status-label">Closed</span>
                        <span class="status-value" id="summary-process-closed">--</span>
                    </div>
                    <div class="d-flex justify-content-between w-100 card-filter-row" data-filter-field="processFilter" data-filter-value="2">
                        <span class="status-label">Escalated</span>
                        <span class="status-value" id="summary-process-escalated">--</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Follow-up Reminder Banner -->
        <div class="followup-banner mb-4">
            <div class="d-flex align-items-center mb-3">
                <i class="bi bi-bell-fill me-2 followup-banner-icon"></i>
                <span class="followup-banner-title">Follow Up Reminder</span>
                <span class="badge followup-banner-badge ms-2" id="followup-banner-count">--</span>
                <span class="ms-auto followup-banner-range">Next 7 days</span>
            </div>
            <div class="followup-chips-wrapper" id="followup-chips-wrapper">
                <span class="text-muted" style="font-size: 13px; padding: 6px 2px;">Loading...</span>
            </div>
        </div>

        <!-- Row 2: Filter Section -->
        <div class="row mb-4">
            <div class="col-12">
                <div class="bento-card">
                    <div class="row g-3 align-items-end">
                        <div class="col-md-3">
                            <label for="searchInput" class="form-label">Search</label>
                            <input type="text" class="form-control" id="searchInput" placeholder="Name, IC, phone or ID">
                        </div>
                        <div class="col-md-2">
                            <label for="consentFilter" class="form-label">Consent Status</label>
                            <select class="form-select" id="consentFilter">
                                <option value="">All</option>
                                <option value="0">Pending</option>
                                <option value="1">Obtained</option>
                                <option value="2">Refused</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="processFilter" class="form-label">Process Status</label>
                            <select class="form-select" id="processFilter">
                                <option value="">All</option>
                                <option value="1">Active</option>
                                <option value="2">Escalated</option>
                                <option value="3">Closed</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="reminderFilter" class="form-label">Follow Up Reminder</label>
                            <select class="form-select" id="reminderFilter">
                                <option value="">All</option>
                                <option value="0">Pending</option>
                                <option value="1">Completed</option>
                                <option value="2">Rescheduled</option>
                                <option value="3">Cancelled</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="enrollmentFilter" class="form-label">Enrollment Type</label>
                            <select class="form-select" id="enrollmentFilter">
                                <option value="">All</option>
                                <option value="1">Primary</option>
                                <option value="2">Follow-up</option>
                            </select>
                        </div>
                    </div>
                    <div class="row g-3 align-items-end mt-1">
                        <div class="col-md-2">
                            <label for="dateFrom" class="form-label">Enrollment From</label>
                            <input type="date" class="form-control" id="dateFrom">
                        </div>
                        <div class="col-md-2">
                            <label for="dateTo" class="form-label">Enrollment To</label>
                            <input type="date" class="form-control" id="dateTo">
                        </div>
                        <div class="col-md-2">
                            <label for="scheduledFrom" class="form-label">Scheduled From</label>
                            <input type="date" class="form-control" id="scheduledFrom">
                        </div>
                        <div class="col-md-2">
                            <label for="scheduledTo" class="form-label">Scheduled To</label>
                            <input type="date" class="form-control" id="scheduledTo">
                        </div>
                        <div class="col-md-2">
                            <label for="consultedByFilter" class="form-label">Consulted By</label>
                            <select class="form-select" id="consultedByFilter">
                                <option value="">All</option>
                                <?php foreach ($doctor_list as $doctor): ?>
                                    <option value="<?php echo (int)$doctor['id']; ?>"><?php echo htmlspecialchars($doctor['nama_staff']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <button type="button" class="btn btn-secondary w-100" id="resetBtn" title="Reset Filters">
                                <i class="bi bi-x-lg me-1"></i>Reset
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Row 3: Data Table -->
        <div class="row">
            <div class="col-12">
                <div class="bento-card">
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" id="patientsTable">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Consult Call ID</th>
                                    <th>Patient Details</th>
                                    <th>Process Status</th>
                                    <th>Consent Status</th>
                                    <th>Enrollment Date</th>
                                    <th>Scheduled Date</th>
                                    <th>Consulted By</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="patientsTableBody">
                                <tr>
                                    <td colspan="10" class="text-center py-4">
                                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                                            <span class="visually-hidden">Loading...</span>
                                        </div>
                                        <span class="ms-2 text-muted">Loading data...</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!-- Pagination -->
                    <div class="d-flex justify-content-between align-items-center mt-3 pagination-wrapper">
                        <div class="d-flex align-items-center">
                            <label for="rowsPerPage" class="me-2 mb-0" style="font-size: 13px;">Show</label>
                            <select class="form-select form-select-sm" id="rowsPerPage" style="width: auto;">
                                <option value="10" selected>10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                            <span class="ms-2" style="font-size: 13px;">entries</span>
                        </div>
                        <div class="d-flex align-items-center">
                            <span id="paginationInfo" class="me-3" style="font-size: 13px;">Showing 0 to 0 of 0 entries</span>
                            <nav>
                                <ul class="pagination pagination-sm mb-0" id="paginationControls">
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        var CC_CONFIG = {
            staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
            permission: <?php echo json_encode($consult_call_permission); ?>,
            apiUrl: 'consultcall/api-jwt.php'
        };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="consultcall/js/main.js?v=<?php echo time(); ?>"></script>
</body>

</html>