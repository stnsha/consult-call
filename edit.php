<?php session_start(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>Edit Patient - Telehealth Consultation Dashboard</title>
    <base href="/odb/">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
    <link href="consultcall/css/style.css?v=<?php echo time(); ?>" rel="stylesheet">
    <style>
        .section-card {
            margin-bottom: 1.5rem;
        }
        .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            padding: 0.75rem 0;
            border-bottom: 1px solid #e9ecef;
            margin-bottom: 1rem;
        }
        .section-header h5 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #212529;
        }
        .section-header .bi {
            transition: transform 0.2s ease;
        }
        .section-header.collapsed .bi-chevron-up {
            transform: rotate(180deg);
        }
        .form-section {
            display: block;
        }
        .form-section.collapsed {
            display: none;
        }
        .readonly-field {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            font-size: 14px;
            color: #495057;
            min-height: 38px;
            display: flex;
            align-items: center;
        }
        .conditional-field {
            display: none !important;
        }
        .conditional-field.visible {
            display: block !important;
        }
        .radio-group {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
        }
        .radio-group .form-check {
            margin-bottom: 0;
        }
        .btn-back {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        .page-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 1.5rem;
        }
        .page-title {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        .page-title h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
        }
        .page-title .patient-id {
            background-color: #f8f9fa;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            color: #495057;
        }
        textarea.form-control {
            height: auto;
            min-height: 80px;
        }
        /* Fix radio button and checkbox visibility */
        .consultcall-container .form-check-input {
            width: 1em !important;
            height: 1em !important;
            margin-top: 0 !important;
            vertical-align: middle !important;
            background-color: #fff !important;
            background-repeat: no-repeat !important;
            background-position: center !important;
            background-size: contain !important;
            border: 1px solid rgba(0,0,0,.25) !important;
            appearance: none !important;
            -webkit-appearance: none !important;
            print-color-adjust: exact !important;
            flex-shrink: 0 !important;
        }
        .consultcall-container .form-check-input[type="radio"] {
            border-radius: 50% !important;
        }
        .consultcall-container .form-check-input[type="checkbox"] {
            border-radius: 0.25em !important;
        }
        .consultcall-container .form-check-input:checked {
            background-color: #0d6efd !important;
            border-color: #0d6efd !important;
        }
        .consultcall-container .form-check-input[type="radio"]:checked {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='-4 -4 8 8'%3e%3ccircle r='2' fill='%23fff'/%3e%3c/svg%3e") !important;
        }
        .consultcall-container .form-check-input[type="checkbox"]:checked {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='m6 10 3 3 6-6'/%3e%3c/svg%3e") !important;
        }
        .consultcall-container .form-check-input:focus {
            border-color: #86b7fe !important;
            outline: 0 !important;
            box-shadow: 0 0 0 0.25rem rgba(13,110,253,.25) !important;
        }
        .consultcall-container .form-check {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            padding-left: 0 !important;
            margin-bottom: 0 !important;
            gap: 0.4em !important;
        }
        /* Ensure columns align content left */
        .consultcall-container .row .col-md-4,
        .consultcall-container .row .col-md-6,
        .consultcall-container .row .col-md-12 {
            text-align: left !important;
        }
        .consultcall-container .form-check .form-check-input {
            float: none;
            margin-left: 0;
            margin-top: 0;
        }
        .consultcall-container .form-check-label {
            cursor: pointer;
            font-size: 14px;
        }
        .consultcall-container .form-label {
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 6px;
        }
        .consultcall-container .form-control,
        .consultcall-container .form-select {
            font-size: 14px;
        }
        /* Radio and checkbox groups sit slightly lower than the label */
        .consultcall-container .radio-group,
        .consultcall-container .form-check {
            padding-top: 2px;
        }
        /* Section cards get a little extra inner padding */
        .consultcall-container .bento-card {
            padding: 1.25rem 1.5rem;
        }
        .field-error {
            color: #dc3545;
            font-size: 0.8rem;
            margin-top: 4px;
            display: block;
        }
        .history-label {
            font-size: 12px;
            font-weight: 600;
            color: #6c757d;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            margin-bottom: 2px;
        }
        .history-value {
            font-size: 14px;
            color: #212529;
            word-break: break-word;
            white-space: pre-wrap;
        }
    </style>
</head>
<?php
require_once('../lock_adv.php');
$connect = 1;
include('../common/index_adv.php');

$consult_call_id = isset($_GET['id']) ? $_GET['id'] : '';
$view_only = isset($_GET['view_only']) ? $_GET['view_only'] : '';

$staffList = array();
$sq = "SELECT id, nama_staff FROM staff WHERE recycle != 1 ORDER BY nama_staff";
$sr = mysqli_query($conn, $sq);
if ($sr) {
    while ($row = mysqli_fetch_assoc($sr)) {
        $staffList[] = array('id' => $row['id'], 'name' => $row['nama_staff']);
    }
}

$outletList = array();
$oq = "SELECT id, code, comp_name FROM outlet ORDER BY comp_name";
$or2 = mysqli_query($conn, $oq);
if ($or2) {
    while ($row = mysqli_fetch_assoc($or2)) {
        $outletList[] = array('code' => $row['code'], 'name' => $row['comp_name']);
    }
}

// HQ staff only (consult_call = 4) for the Handled By dropdown
$hqStaffList = array();
$hq_q = "SELECT id, nama_staff FROM staff WHERE consult_call = 4 AND recycle != 1 ORDER BY nama_staff";
$hq_r = mysqli_query($conn, $hq_q);
if ($hq_r) {
    while ($row = mysqli_fetch_assoc($hq_r)) {
        $hqStaffList[] = array('id' => $row['id'], 'name' => $row['nama_staff']);
    }
}

// Resolve current staff role and ID from session
$currentStaffRole = 0;
$currentStaffId = null;
if (isset($_SESSION["myusername"])) {
    $cs_q = "SELECT id, consult_call FROM staff WHERE username = '" . mysqli_real_escape_string($conn, $_SESSION["myusername"]) . "' AND recycle != 1";
    $cs_r = mysqli_query($conn, $cs_q);
    if ($cs_r && $cs_row = mysqli_fetch_assoc($cs_r)) {
        $currentStaffRole = (int)$cs_row['consult_call'];
        $currentStaffId   = (int)$cs_row['id'];
    }
}

// Dev role override (localhost only) -- matches the dev role switcher in navbar
$_ep_serverName = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '';
$_ep_httpHost   = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
$_ep_isLocal    = in_array($_ep_serverName, array('localhost', '127.0.0.1'))
    || strpos($_ep_serverName, 'localhost') !== false
    || strpos($_ep_httpHost, 'localhost') !== false
    || strpos($_ep_httpHost, '127.0.0.1') !== false;
if ($_ep_isLocal && isset($_SESSION['dev_role_override'])) {
    $currentStaffRole = (int)$_SESSION['dev_role_override'];
}

// Eligibility section controls are disabled for non-HQ roles
$eD = ($currentStaffRole !== 4) ? 'disabled' : '';

// Consultation Details controls are disabled for non-Doctor roles
$dD = ($currentStaffRole !== 2) ? 'disabled' : '';
?>
<body>
    <?php include('navbar.php'); ?>
    <div class="consultcall-container mb-3">
        <!-- Page Header -->
        <div class="page-header">
            <div class="page-title">
                <a href="consultcall/index.php" class="btn btn-outline-secondary btn-back">
                    <i class="bi bi-arrow-left"></i> Back
                </a>
                <h1>Edit Patient</h1>
                <span class="patient-id" id="consult-call-id">--</span>
            </div>
        </div>

        <form id="editPatientForm" method="post">
            <!-- Row 1: Patient Details & Blood Test Report -->
            <div class="row g-4 mb-4">
                <!-- Section 1: Patient Details (Read-only) -->
                <div class="col-md-6">
                    <div class="bento-card h-100">
                        <div class="section-header" data-section="patient-details">
                            <h5><i class="bi bi-person me-2"></i>Patient Details</h5>
                            <div class="d-flex align-items-center gap-2">
                                <button type="button" id="btn-view-customer" class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); openCustomerModal();" style="display:none;">
                                    <i class="bi bi-person-lines-fill me-1"></i>View Customer
                                </button>
                                <i class="bi bi-chevron-up"></i>
                            </div>
                        </div>
                        <div class="form-section" id="section-patient-details">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">Name</label>
                                    <div class="readonly-field" id="patient-name">--</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">IC No</label>
                                    <div class="readonly-field" id="patient-icno">--</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Phone</label>
                                    <div class="readonly-field" id="patient-phone">--</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Email</label>
                                    <div class="readonly-field" id="patient-email">--</div>
                                </div>
                                <div class="col-md-12">
                                    <label class="form-label">Address</label>
                                    <div class="readonly-field" id="patient-address">--</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Age</label>
                                    <div class="readonly-field" id="patient-age">--</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Gender</label>
                                    <div class="readonly-field" id="patient-gender">--</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 2: Consultation History -->
                <div class="col-md-6">
                    <div class="bento-card h-100" id="consultation-history-section">
                        <div class="section-header" data-section="consultation-history">
                            <h5><i class="bi bi-clock-history me-2"></i>Consultation History</h5>
                            <i class="bi bi-chevron-up"></i>
                        </div>
                        <div class="form-section" id="section-consultation-history">
                            <div id="consultation-history-container">
                                <div class="text-muted small">No consultation history.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section 3: ConsultCall Eligibility -->
            <div class="bento-card section-card">
                <div class="section-header" data-section="eligibility">
                    <h5><i class="bi bi-clipboard-check me-2"></i>ConsultCall Eligibility
                        <?php if ($eD): ?>
                        <span style="font-size:11px;font-weight:400;color:#888;margin-left:8px;">
                            <i class="bi bi-lock-fill"></i> View only
                        </span>
                        <?php endif; ?>
                    </h5>
                    <i class="bi bi-chevron-up"></i>
                </div>
                <div class="form-section" id="section-eligibility">
                    <div class="row g-4">
                        <!-- Consent Status -->
                        <div class="col-md-12">
                            <label class="form-label">Consent Status<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consent_status" id="consent_pending" value="0" checked <?php echo $eD; ?>>
                                    <label class="form-check-label" for="consent_pending">Pending</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consent_status" id="consent_obtained" value="1" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="consent_obtained">Obtained</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consent_status" id="consent_refused" value="2" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="consent_refused">Refused</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consent_status" id="consent_on_medication" value="3" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="consent_on_medication">On Prescribed Medication</label>
                                </div>
                            </div>
                        </div>

                        <!-- Conditional fields when consent = obtained -->
                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Consent Date<span style="color:red;"> *</span></label>
                            <input type="date" class="form-control" name="consent_call_date" id="consent_call_date" <?php echo $eD; ?>>
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Scheduled Consult Date &amp; Time<span style="color:red;"> *</span></label>
                            <input type="date" class="form-control" name="scheduled_call_date" id="scheduled_call_date" <?php echo $eD; ?>>
                        </div>

                        <div class="col-md-12 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Scheduled Status<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="scheduled_status" id="scheduled_confirmed" value="1" checked <?php echo $eD; ?>>
                                    <label class="form-check-label" for="scheduled_confirmed">Confirmed</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="scheduled_status" id="scheduled_reschedule" value="2" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="scheduled_reschedule">Reschedule</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="scheduled_status" id="scheduled_cancelled" value="3" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="scheduled_cancelled">Cancelled</label>
                                </div>
                            </div>
                        </div>

                        <!-- Conditional field when scheduled_status = reschedule -->
                        <div class="col-md-6 conditional-field" data-condition="scheduled_reschedule">
                            <label class="form-label">Updated Scheduled Date<span style="color:red;"> *</span></label>
                            <input type="date" class="form-control" name="updated_scheduled_date" id="updated_scheduled_date" <?php echo $eD; ?>>
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Handled By<span style="color:red;"> *</span></label>
                            <select class="form-select" name="handled_by" id="handled_by" <?php echo $eD; ?>>
                                <option value="">Select Staff</option>
                                <?php foreach ($hqStaffList as $staff): ?>
                                <option value="<?php echo htmlspecialchars($staff['id']); ?>"
                                    <?php echo ($currentStaffRole === 4 && $staff['id'] == $currentStaffId) ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($staff['name']); ?>
                                </option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Mode of Consult<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_consultation" id="mode_phone" value="1" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="mode_phone">Phone</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_consultation" id="mode_google_meet" value="2" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="mode_google_meet">Google Meet</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_consultation" id="mode_whatsapp" value="3" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="mode_whatsapp">WhatsApp</label>
                                </div>
                            </div>
                        </div>

                        <!-- Conditional field when consent = refused -->
                        <div class="col-md-12 conditional-field" data-condition="consent_refused">
                            <label class="form-label">Remarks<span style="color:red;"> *</span></label>
                            <textarea class="form-control" name="refusal_remarks" id="refusal_remarks" rows="3" placeholder="Enter reason for refusal" <?php echo $eD; ?>></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Follow-up Checkpoint (shown by JS when doctor opted for follow-up) -->
            <div class="bento-card section-card" id="followup-checkpoint-section" style="display:none;">
                <div class="section-header" data-section="followup-checkpoint">
                    <h5><i class="bi bi-calendar2-check me-2"></i>Follow-up Checkpoint
                        <?php if ($eD): ?>
                        <span style="font-size:11px;font-weight:400;color:#888;margin-left:8px;">
                            <i class="bi bi-lock-fill"></i> View only
                        </span>
                        <?php endif; ?>
                    </h5>
                    <i class="bi bi-chevron-up"></i>
                </div>
                <div class="form-section" id="section-followup-checkpoint">
                    <div class="row g-4">
                        <div class="col-md-12">
                            <label class="form-label">Follow-up Reminder Status<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_reminder" id="reminder_pending" value="0" checked <?php echo $eD; ?>>
                                    <label class="form-check-label" for="reminder_pending">Pending</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_reminder" id="reminder_completed" value="1" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="reminder_completed">Completed</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_reminder" id="reminder_rescheduled" value="2" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="reminder_rescheduled">Rescheduled</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_reminder" id="reminder_cancelled" value="3" <?php echo $eD; ?>>
                                    <label class="form-check-label" for="reminder_cancelled">Cancelled</label>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label">Follow-up Date<span style="color:red;"> *</span></label>
                            <input type="date" class="form-control" name="checkpoint_followup_date" id="checkpoint_followup_date" <?php echo $eD; ?>>
                        </div>
                        <div class="col-md-6 conditional-field" data-condition="reminder_rescheduled">
                            <label class="form-label">Rescheduled Date<span style="color:red;"> *</span></label>
                            <input type="date" class="form-control" name="rescheduled_date" id="rescheduled_date" <?php echo $eD; ?>>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section 3: Consultation Details (hidden by default, shown when consent = obtained) -->
            <div class="bento-card section-card" id="consultation-section" style="display:none;">
                <div class="section-header" data-section="consultation">
                    <h5><i class="bi bi-journal-medical me-2"></i>Consultation Details
                        <?php if ($dD): ?>
                        <span style="font-size:11px;font-weight:400;color:#888;margin-left:8px;">
                            <i class="bi bi-lock-fill"></i> View only
                        </span>
                        <?php endif; ?>
                    </h5>
                    <i class="bi bi-chevron-up"></i>
                </div>
                <div class="form-section" id="section-consultation">
                    <div class="row g-4">
                        <!-- Consult Date -->
                        <div class="col-md-6">
                            <label class="form-label">Consult Date<span style="color:red;"> *</span></label>
                            <input type="date" class="form-control" name="consult_date" id="consult_date" <?php echo $dD; ?>>
                        </div>

                        <!-- Consulted By -->
                        <div class="col-md-6">
                            <label class="form-label">Consulted By<span style="color:red;"> *</span></label>
                            <select class="form-select" name="consulted_by" id="consulted_by" <?php echo $dD; ?>>
                                <option value="">Select Staff</option>
                                <?php foreach ($staffList as $staff): ?>
                                <option value="<?php echo htmlspecialchars($staff['id']); ?>"><?php echo htmlspecialchars($staff['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <!-- Consult Status -->
                        <div class="col-md-12">
                            <label class="form-label">Consult Status<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consult_status" id="consult_pending" value="0" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="consult_pending">Pending</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consult_status" id="consult_completed" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="consult_completed">Completed</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consult_status" id="consult_no_show" value="2" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="consult_no_show">No-show</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consult_status" id="consult_cancelled" value="3" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="consult_cancelled">Cancelled</label>
                                </div>
                            </div>
                        </div>

                        <!-- Documentation -->
                        <div class="col-md-12 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Documentation<span style="color:red;"> *</span></label>
                            <textarea class="form-control" name="documentation" id="documentation" rows="5" placeholder="Enter documentation" <?php echo $dD; ?>></textarea>
                        </div>

                        <!-- Diagnosis -->
                        <div class="col-md-12 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Diagnosis<span style="color:red;"> *</span></label>
                            <textarea class="form-control" name="diagnosis" id="diagnosis" rows="10" placeholder="Enter diagnosis" <?php echo $dD; ?>></textarea>
                        </div>

                        <!-- Treatment Plan -->
                        <div class="col-md-12 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Treatment Plan<span style="color:red;"> *</span></label>
                            <textarea class="form-control" name="treatment_plan" id="treatment_plan" rows="10" placeholder="Enter treatment plan" <?php echo $dD; ?>></textarea>
                        </div>

                        <!-- Rx Issued -->
                        <div class="col-md-12 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Rx Issued<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="rx_issued" id="rx_issued_yes" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="rx_issued_yes">Yes</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="rx_issued" id="rx_issued_no" value="0" checked <?php echo $dD; ?>>
                                    <label class="form-check-label" for="rx_issued_no">No</label>
                                </div>
                            </div>
                        </div>

                        <!-- Blood Test Required | Follow Up Type -->
                        <div class="col-md-6 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Blood Test Required<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="is_blood_test_required" id="blood_test_yes" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="blood_test_yes">Yes</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="is_blood_test_required" id="blood_test_no" value="0" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="blood_test_no">No</label>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Follow Up Type<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_type" id="followup_type_no" value="0" checked <?php echo $dD; ?>>
                                    <label class="form-check-label" for="followup_type_no">No</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_type" id="followup_blood_review" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="followup_blood_review">Blood Test + Review</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_type" id="followup_review_only" value="2" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="followup_review_only">Review Only</label>
                                </div>
                            </div>
                        </div>

                        <!-- Next Follow Up | Next Follow Up Date -->
                        <div class="col-md-6 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Next Follow Up<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_none" value="0" checked <?php echo $dD; ?>>
                                    <label class="form-check-label" for="followup_none">None</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_1month" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="followup_1month">1 Month</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_3months" value="2" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="followup_3months">3 Months</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_6months" value="3" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="followup_6months">6 Months</label>
                                </div>
                            </div>
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consult_completed" id="next-followup-date-container" style="display:none;">
                            <label class="form-label">Next Follow Up Date</label>
                            <input type="date" class="form-control" name="followup_date" id="followup_date" <?php echo $dD; ?>>
                        </div>

                        <!-- Mode of Conversion -->
                        <div class="col-md-6 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Mode of Conversion<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_conversion" id="conversion_none" value="0" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="conversion_none">None</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_conversion" id="conversion_outlet" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="conversion_outlet">Outlet</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_conversion" id="conversion_clinic" value="2" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="conversion_clinic">Clinic</label>
                                </div>
                            </div>
                        </div>

                        <!-- Action -->
                        <div class="col-md-12 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Action<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="action" id="action_refer_outlet" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="action_refer_outlet">Refer Internal</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="action" id="action_refer_clinic" value="2" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="action_refer_clinic">Refer External</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="action" id="action_end_process" value="3" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="action_end_process">End Process</label>
                                </div>
                            </div>
                        </div>

                        <!-- Process Status (doctor-controlled; auto-locked to Closed by JS when action forces it) -->
                        <div class="col-md-12 conditional-field" data-condition="consult_completed">
                            <label class="form-label">Process Status<span style="color:red;"> *</span></label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="process_status" id="process_active" value="1" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="process_active">Active</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="process_status" id="process_closed" value="3" <?php echo $dD; ?>>
                                    <label class="form-check-label" for="process_closed">Closed</label>
                                </div>
                            </div>
                        </div>

                        <!-- Remarks (visible for all consult statuses) -->
                        <div class="col-md-12">
                            <label class="form-label">Remarks<span style="color:red;"> *</span></label>
                            <textarea class="form-control" name="remarks" id="remarks" rows="3" placeholder="Enter any additional remarks" <?php echo $dD; ?>></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Save Button -->
            <div class="d-flex justify-content-end gap-2 mt-4" id="form-actions">
                <a href="consultcall/index.php" class="btn btn-outline-secondary">Cancel</a>
                <button type="submit" class="btn btn-primary" id="saveBtn">
                    <i class="bi bi-check-lg me-1"></i>Save Changes
                </button>
            </div>
        </form>

        <!-- MyReferral section — shown by JS on page load when saved action requires a referral and none exists yet -->
        <div id="myreferral-section" class="bento-card mt-4" style="display:none;">
            <div class="section-header d-flex justify-content-between align-items-center">
                <h6 class="mb-0">MyReferral</h6>
            </div>
            <div class="p-3">
                <p class="text-muted mb-3">A referral is required for this action. Please create a MyReferral record to complete the process.</p>
                <a id="myreferral-create-btn" href="/odb/referral/create.php" target="_blank" rel="noopener" class="btn btn-outline-primary">
                    <i class="bi bi-plus-circle me-1"></i>Create MyReferral
                </a>
            </div>
        </div>
    </div>

    <!-- PDF Modal -->
    <div class="modal fade" id="pdfModal" tabindex="-1" aria-labelledby="pdfModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="pdfModalLabel">Blood Test Report</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-0">
                    <iframe id="pdfViewer" src="" style="width: 100%; height: 75vh; border: none;"></iframe>
                </div>
            </div>
        </div>
    </div>

    <!-- Customer Modal -->
    <div class="modal fade" id="customerModal" tabindex="-1" aria-labelledby="customerModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="customerModalLabel">Customer Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body p-0">
                    <iframe id="customerViewer" src="" style="width: 100%; height: 75vh; border: none;"></iframe>
                </div>
            </div>
        </div>
    </div>

    <script>
    var EDIT_CONFIG = {
        consultCallId: <?php echo json_encode($consult_call_id); ?>,
        viewOnly: <?php echo json_encode($view_only === 'true'); ?>,
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        currentStaffId: <?php echo json_encode($currentStaffId); ?>,
        currentStaffRole: <?php echo json_encode($currentStaffRole); ?>,
        apiUrl: 'consultcall/api-jwt.php'
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="consultcall/js/edit.js?v=<?php echo time(); ?>"></script>
</body>
</html>
