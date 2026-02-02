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
?>
<body>
    <?php // include('navbar.php'); ?>
    <div class="consultcall-container mb-3">
<?php
// Dummy data for patients - PHP 5.3 compatible syntax
$patients = array(
    array(
        'consult_call_id' => '#CC001',
        'name' => 'Ahmad bin Ismail',
        'icno' => '850615-01-5678',
        'phone' => '60123456789',
        'consent_status' => 'obtained',
        'process_status' => 'active',
        'followup_reminder' => 'pending',
        'enrollment' => 'follow-up',
        'enrollment_date' => '2026-01-15',
        'last_consultation' => '2026-01-28'
    ),
    array(
        'consult_call_id' => '#CC002',
        'name' => 'Siti Nurhaliza binti Abdullah',
        'icno' => '900220-14-5432',
        'phone' => '60198765432',
        'consent_status' => 'pending',
        'process_status' => 'active',
        'followup_reminder' => 'pending',
        'enrollment' => 'primary',
        'enrollment_date' => '2026-01-31',
        'last_consultation' => ''
    ),
    array(
        'consult_call_id' => '#CC003',
        'name' => 'Raj Kumar a/l Subramaniam',
        'icno' => '780812-08-7890',
        'phone' => '60167890123',
        'consent_status' => 'obtained',
        'process_status' => 'closed',
        'followup_reminder' => 'completed',
        'enrollment' => 'follow-up',
        'enrollment_date' => '2026-01-10',
        'last_consultation' => '2026-01-20'
    ),
    array(
        'consult_call_id' => '#CC004',
        'name' => 'Lim Wei Ling',
        'icno' => '950505-10-1234',
        'phone' => '60134567890',
        'consent_status' => 'refused',
        'process_status' => 'closed',
        'followup_reminder' => 'cancelled',
        'enrollment' => 'primary',
        'enrollment_date' => '2026-01-22',
        'last_consultation' => ''
    ),
    array(
        'consult_call_id' => '#CC005',
        'name' => 'Fatimah binti Hassan',
        'icno' => '880930-03-9012',
        'phone' => '60145678901',
        'consent_status' => 'pending',
        'process_status' => 'escalated',
        'followup_reminder' => 'rescheduled',
        'enrollment' => 'primary',
        'enrollment_date' => '2026-01-30',
        'last_consultation' => ''
    ),
    array(
        'consult_call_id' => '#CC006',
        'name' => 'Tan Ah Kow',
        'icno' => '700115-07-3456',
        'phone' => '60156789012',
        'consent_status' => 'obtained',
        'process_status' => 'active',
        'followup_reminder' => 'pending',
        'enrollment' => 'follow-up',
        'enrollment_date' => '2026-01-05',
        'last_consultation' => '2026-01-29'
    )
);

// Helper function to format date - PHP 5.3 compatible
function formatEnrollmentDate($dateStr) {
    $timestamp = strtotime($dateStr);
    return date('D, j M Y', $timestamp);
}

// Calculate statistics for consent status
$consentPending = 0;
$consentObtained = 0;
$consentRefused = 0;

// Calculate statistics for process status
$processActive = 0;
$processClosed = 0;
$processEscalated = 0;

// Calculate statistics for follow up reminder
$reminderPending = 0;
$reminderCompleted = 0;
$reminderRescheduled = 0;
$reminderCancelled = 0;

// Calculate enrollment type counts
$enrollmentPrimary = 0;
$enrollmentFollowUp = 0;

foreach ($patients as $patient) {
    // Consent status counts
    if ($patient['consent_status'] === 'pending') {
        $consentPending++;
    } elseif ($patient['consent_status'] === 'obtained') {
        $consentObtained++;
    } elseif ($patient['consent_status'] === 'refused') {
        $consentRefused++;
    }

    // Process status counts
    if ($patient['process_status'] === 'active') {
        $processActive++;
    } elseif ($patient['process_status'] === 'closed') {
        $processClosed++;
    } elseif ($patient['process_status'] === 'escalated') {
        $processEscalated++;
    }

    // Follow up reminder counts
    if ($patient['followup_reminder'] === 'pending') {
        $reminderPending++;
    } elseif ($patient['followup_reminder'] === 'completed') {
        $reminderCompleted++;
    } elseif ($patient['followup_reminder'] === 'rescheduled') {
        $reminderRescheduled++;
    } elseif ($patient['followup_reminder'] === 'cancelled') {
        $reminderCancelled++;
    }

    // Enrollment counts
    if ($patient['enrollment'] === 'primary') {
        $enrollmentPrimary++;
    } elseif ($patient['enrollment'] === 'follow-up') {
        $enrollmentFollowUp++;
    }
}

$totalPatients = count($patients);
$totalConsent = $consentPending + $consentObtained + $consentRefused;
$totalProcess = $processActive + $processClosed + $processEscalated;
$totalReminder = $reminderPending + $reminderCompleted + $reminderRescheduled + $reminderCancelled;
?>

        <div class="row mb-4">
            <div class="col-12">
                <h1 class="mb-1 fw-bold" style="font-size: 18px; font-weight: 500; text-align: left;">ConsultCall Dashboard</h1>
                <p class="text-muted mb-0" style="font-size: 13px; text-align: left;">Track and manage telehealth patient consultations</p>
            </div>
        </div>

        <!-- Row 1: Overview Cards -->
        <div class="row g-4 mb-4">
            <!-- Total Patients Card -->
            <div class="col-md-3">
                <div class="bento-card h-100">
                    <div class="d-flex align-items-center mb-3">
                        <div class="card-icon bg-primary bg-opacity-10 text-primary">
                            <i class="bi bi-people"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Total Patients</h6>
                            <h2 class="card-value mb-0"><?php echo $totalPatients; ?></h2>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Primary</span>
                        <span class="status-value"><?php echo $enrollmentPrimary; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Follow-up</span>
                        <span class="status-value"><?php echo $enrollmentFollowUp; ?></span>
                    </div>
                </div>
            </div>
            <!-- Consent Status Card -->
            <div class="col-md-3">
                <div class="bento-card h-100">
                    <div class="d-flex align-items-center mb-3">
                        <div class="card-icon bg-warning bg-opacity-10 text-warning">
                            <i class="bi bi-clipboard-check"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Consent Status</h6>
                            <h2 class="card-value mb-0"><?php echo $totalConsent; ?></h2>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Pending</span>
                        <span class="status-value"><?php echo $consentPending; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Obtained</span>
                        <span class="status-value"><?php echo $consentObtained; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Refused</span>
                        <span class="status-value"><?php echo $consentRefused; ?></span>
                    </div>
                </div>
            </div>
            <!-- Process Status Card -->
            <div class="col-md-3">
                <div class="bento-card h-100">
                    <div class="d-flex align-items-center mb-3">
                        <div class="card-icon bg-info bg-opacity-10 text-info">
                            <i class="bi bi-gear"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Process Status</h6>
                            <h2 class="card-value mb-0"><?php echo $totalProcess; ?></h2>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Active</span>
                        <span class="status-value"><?php echo $processActive; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Closed</span>
                        <span class="status-value"><?php echo $processClosed; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Escalated</span>
                        <span class="status-value"><?php echo $processEscalated; ?></span>
                    </div>
                </div>
            </div>
            <!-- Follow Up Reminder Card -->
            <div class="col-md-3">
                <div class="bento-card h-100">
                    <div class="d-flex align-items-center mb-3">
                        <div class="card-icon bg-success bg-opacity-10 text-success">
                            <i class="bi bi-bell"></i>
                        </div>
                        <div class="ms-3 text-start">
                            <h6 class="card-subtitle text-muted mb-1">Follow Up Reminder</h6>
                            <h2 class="card-value mb-0"><?php echo $totalReminder; ?></h2>
                        </div>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Pending</span>
                        <span class="status-value"><?php echo $reminderPending; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Completed</span>
                        <span class="status-value"><?php echo $reminderCompleted; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Rescheduled</span>
                        <span class="status-value"><?php echo $reminderRescheduled; ?></span>
                    </div>
                    <div class="d-flex justify-content-between w-100">
                        <span class="status-label">Cancelled</span>
                        <span class="status-value"><?php echo $reminderCancelled; ?></span>
                    </div>
                </div>
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
                                <option value="pending">Pending</option>
                                <option value="obtained">Obtained</option>
                                <option value="refused">Refused</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="processFilter" class="form-label">Process Status</label>
                            <select class="form-select" id="processFilter">
                                <option value="">All</option>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                                <option value="escalated">Escalated</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="reminderFilter" class="form-label">Follow Up Reminder</label>
                            <select class="form-select" id="reminderFilter">
                                <option value="">All</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="rescheduled">Rescheduled</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                        <div class="col-md-2">
                            <label for="enrollmentFilter" class="form-label">Enrollment Type</label>
                            <select class="form-select" id="enrollmentFilter">
                                <option value="">All</option>
                                <option value="primary">Primary</option>
                                <option value="follow-up">Follow-up</option>
                            </select>
                        </div>
                        <div class="col-md-1">
                            <button type="button" class="btn btn-secondary w-100" id="resetBtn" title="Reset Filters">
                                <i class="bi bi-x-lg"></i>
                            </button>
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
                            <label for="lastConsultFrom" class="form-label">Last Consult From</label>
                            <input type="date" class="form-control" id="lastConsultFrom">
                        </div>
                        <div class="col-md-2">
                            <label for="lastConsultTo" class="form-label">Last Consult To</label>
                            <input type="date" class="form-control" id="lastConsultTo">
                        </div>
                        <div class="col-md-2">
                            <button type="button" class="btn btn-primary w-100" id="filterBtn">
                                <i class="bi bi-funnel me-1"></i>Apply Filter
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
                                    <th>Consent Status</th>
                                    <th>Process Status</th>
                                    <th>Follow Up Reminder</th>
                                    <th>Enrollment Type</th>
                                    <th>Enrollment Date</th>
                                    <th>Last Consultation</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                $rowNum = 1;
                                foreach ($patients as $patient) {
                                    // Consent status badge class
                                    $consentClass = '';
                                    if ($patient['consent_status'] === 'pending') {
                                        $consentClass = 'bg-warning';
                                    } elseif ($patient['consent_status'] === 'obtained') {
                                        $consentClass = 'bg-success';
                                    } elseif ($patient['consent_status'] === 'refused') {
                                        $consentClass = 'bg-danger';
                                    }

                                    // Process status badge class
                                    $processClass = '';
                                    if ($patient['process_status'] === 'active') {
                                        $processClass = 'bg-success';
                                    } elseif ($patient['process_status'] === 'closed') {
                                        $processClass = 'bg-secondary';
                                    } elseif ($patient['process_status'] === 'escalated') {
                                        $processClass = 'bg-danger';
                                    }

                                    // Follow up reminder badge class
                                    $reminderClass = '';
                                    if ($patient['followup_reminder'] === 'pending') {
                                        $reminderClass = 'bg-warning';
                                    } elseif ($patient['followup_reminder'] === 'completed') {
                                        $reminderClass = 'bg-success';
                                    } elseif ($patient['followup_reminder'] === 'rescheduled') {
                                        $reminderClass = 'bg-info';
                                    } elseif ($patient['followup_reminder'] === 'cancelled') {
                                        $reminderClass = 'bg-danger';
                                    }

                                    // Enrollment badge class
                                    $enrollmentClass = ($patient['enrollment'] === 'primary') ? 'bg-primary' : 'bg-secondary';

                                    // Last consultation display
                                    $lastConsultDisplay = '';
                                    if ($patient['enrollment'] === 'primary' || empty($patient['last_consultation'])) {
                                        $lastConsultDisplay = '<span class="text-muted">-</span>';
                                    } else {
                                        $lastConsultDisplay = htmlspecialchars(formatEnrollmentDate($patient['last_consultation']));
                                    }

                                    echo '<tr data-consent="' . htmlspecialchars($patient['consent_status']) . '" data-process="' . htmlspecialchars($patient['process_status']) . '" data-reminder="' . htmlspecialchars($patient['followup_reminder']) . '" data-enrollment="' . htmlspecialchars($patient['enrollment']) . '" data-enrollment-date="' . htmlspecialchars($patient['enrollment_date']) . '" data-last-consult="' . htmlspecialchars($patient['last_consultation']) . '">';
                                    echo '<td>' . $rowNum . '</td>';
                                    echo '<td><code>' . htmlspecialchars($patient['consult_call_id']) . '</code></td>';
                                    echo '<td class="patient-details">';
                                    echo '<div class="fw-medium">' . htmlspecialchars($patient['name']) . '</div>';
                                    echo '<small class="text-muted">' . htmlspecialchars($patient['icno']) . '</small><br>';
                                    echo '<small class="text-muted"><i class="bi bi-telephone me-1"></i>' . htmlspecialchars($patient['phone']) . '</small>';
                                    echo '</td>';
                                    echo '<td><span class="badge ' . $consentClass . '">' . ucfirst(htmlspecialchars($patient['consent_status'])) . '</span></td>';
                                    echo '<td><span class="badge ' . $processClass . '">' . ucfirst(htmlspecialchars($patient['process_status'])) . '</span></td>';
                                    echo '<td><span class="badge ' . $reminderClass . '">' . ucfirst(htmlspecialchars($patient['followup_reminder'])) . '</span></td>';
                                    echo '<td><span class="badge ' . $enrollmentClass . '">' . ucfirst(htmlspecialchars($patient['enrollment'])) . '</span></td>';
                                    echo '<td>' . htmlspecialchars(formatEnrollmentDate($patient['enrollment_date'])) . '</td>';
                                    echo '<td>' . $lastConsultDisplay . '</td>';
                                    echo '<td>';
                                    echo '<button class="btn btn-sm btn-outline-primary me-1" title="View"><i class="bi bi-eye"></i></button>';
                                    echo '<button class="btn btn-sm btn-outline-secondary" title="Edit"><i class="bi bi-pencil"></i></button>';
                                    echo '</td>';
                                    echo '</tr>';
                                    $rowNum++;
                                }
                                ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="consultcall/js/main.js?v=<?php echo time(); ?>"></script>
</body>
</html>
