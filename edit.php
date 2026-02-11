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
        }
        .consultcall-container .form-control,
        .consultcall-container .form-select {
            font-size: 14px;
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
                            <i class="bi bi-chevron-up"></i>
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
                                <div class="col-md-4">
                                    <label class="form-label">Age</label>
                                    <div class="readonly-field" id="patient-age">--</div>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Gender</label>
                                    <div class="readonly-field" id="patient-gender">--</div>
                                </div>
                                <div class="col-md-4">
                                    <label class="form-label">Risk Tier</label>
                                    <div class="readonly-field" id="patient-risk-tier">--</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Section 2: Blood Test Report (Read-only) -->
                <div class="col-md-6">
                    <div class="bento-card h-100">
                        <div class="section-header" data-section="blood-test">
                            <h5><i class="bi bi-file-earmark-medical me-2"></i>Blood Test Report</h5>
                            <i class="bi bi-chevron-up"></i>
                        </div>
                        <div class="form-section" id="section-blood-test">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label">Collected Date</label>
                                    <div class="readonly-field" id="blood-test-date">--</div>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label">Report</label>
                                    <div>
                                        <a href="javascript:void(0);" class="btn btn-outline-danger" onclick="openPdfReport()" title="View Blood Test Report">
                                            <i class="bi bi-file-earmark-pdf me-1"></i>View PDF
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section 3: ConsultCall Eligibility -->
            <div class="bento-card section-card">
                <div class="section-header" data-section="eligibility">
                    <h5><i class="bi bi-clipboard-check me-2"></i>ConsultCall Eligibility</h5>
                    <i class="bi bi-chevron-up"></i>
                </div>
                <div class="form-section" id="section-eligibility">
                    <div class="row g-3">
                        <!-- Consent Status -->
                        <div class="col-md-12">
                            <label class="form-label">Consent Status</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consent_status" id="consent_pending" value="0" checked>
                                    <label class="form-check-label" for="consent_pending">Pending</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consent_status" id="consent_obtained" value="1">
                                    <label class="form-check-label" for="consent_obtained">Obtained</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consent_status" id="consent_refused" value="2">
                                    <label class="form-check-label" for="consent_refused">Refused</label>
                                </div>
                            </div>
                        </div>

                        <!-- Conditional fields when consent = obtained -->
                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Consent Date</label>
                            <input type="date" class="form-control" name="consent_call_date" id="consent_call_date">
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Scheduled Consult Date &amp; Time</label>
                            <input type="date" class="form-control" name="scheduled_call_date" id="scheduled_call_date">
                        </div>

                        <div class="col-md-12 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Scheduled Status</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="scheduled_status" id="scheduled_confirmed" value="1" checked>
                                    <label class="form-check-label" for="scheduled_confirmed">Confirmed</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="scheduled_status" id="scheduled_reschedule" value="2">
                                    <label class="form-check-label" for="scheduled_reschedule">Reschedule</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="scheduled_status" id="scheduled_cancelled" value="3">
                                    <label class="form-check-label" for="scheduled_cancelled">Cancelled</label>
                                </div>
                            </div>
                        </div>

                        <!-- Conditional field when scheduled_status = reschedule -->
                        <div class="col-md-6 conditional-field" data-condition="scheduled_reschedule">
                            <label class="form-label">Updated Scheduled Date</label>
                            <input type="datetime-local" class="form-control" name="updated_scheduled_date" id="updated_scheduled_date">
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Handled By</label>
                            <select class="form-select" name="handled_by" id="handled_by">
                                <option value="">Select Staff</option>
                                <?php foreach ($staffList as $staff): ?>
                                <option value="<?php echo htmlspecialchars($staff['id']); ?>"><?php echo htmlspecialchars($staff['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <div class="col-md-6 conditional-field" data-condition="consent_obtained">
                            <label class="form-label">Mode of Consult</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_consultation" id="mode_phone" value="1">
                                    <label class="form-check-label" for="mode_phone">Phone</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_consultation" id="mode_google_meet" value="2">
                                    <label class="form-check-label" for="mode_google_meet">Google Meet</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_consultation" id="mode_whatsapp" value="3">
                                    <label class="form-check-label" for="mode_whatsapp">WhatsApp</label>
                                </div>
                            </div>
                        </div>

                        <!-- Conditional field when consent = refused -->
                        <div class="col-md-12 conditional-field" data-condition="consent_refused">
                            <label class="form-label">Remarks</label>
                            <textarea class="form-control" name="refusal_remarks" id="refusal_remarks" rows="3" placeholder="Enter reason for refusal"></textarea>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Section 3: Consultation Details (hidden by default, shown when consent = obtained) -->
            <div class="bento-card section-card conditional-field" data-condition="consent_obtained" id="consultation-section">
                <div class="section-header" data-section="consultation">
                    <h5><i class="bi bi-journal-medical me-2"></i>Consultation Details</h5>
                    <i class="bi bi-chevron-up"></i>
                </div>
                <div class="form-section" id="section-consultation">
                    <div class="row g-3">
                        <!-- Consult Date -->
                        <div class="col-md-6">
                            <label class="form-label">Consult Date</label>
                            <input type="date" class="form-control" name="consult_date" id="consult_date">
                        </div>

                        <!-- Consulted By -->
                        <div class="col-md-6">
                            <label class="form-label">Consulted By</label>
                            <select class="form-select" name="consulted_by" id="consulted_by">
                                <option value="">Select Staff</option>
                                <?php foreach ($staffList as $staff): ?>
                                <option value="<?php echo htmlspecialchars($staff['id']); ?>"><?php echo htmlspecialchars($staff['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <!-- Consult Status -->
                        <div class="col-md-12">
                            <label class="form-label">Consult Status</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consult_status" id="consult_completed" value="1">
                                    <label class="form-check-label" for="consult_completed">Completed</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consult_status" id="consult_no_show" value="2">
                                    <label class="form-check-label" for="consult_no_show">No-show</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="consult_status" id="consult_cancelled" value="3">
                                    <label class="form-check-label" for="consult_cancelled">Cancelled</label>
                                </div>
                            </div>
                        </div>

                        <!-- Diagnosis -->
                        <div class="col-md-12">
                            <label class="form-label">Diagnosis</label>
                            <textarea class="form-control" name="diagnosis" id="diagnosis" rows="3" placeholder="Enter diagnosis"></textarea>
                        </div>

                        <!-- Treatment Plan -->
                        <div class="col-md-12">
                            <label class="form-label">Treatment Plan</label>
                            <textarea class="form-control" name="treatment_plan" id="treatment_plan" rows="3" placeholder="Enter treatment plan"></textarea>
                        </div>

                        <!-- Rx Issued -->
                        <div class="col-md-6">
                            <label class="form-label">Rx Issued</label>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" name="rx_issued" id="rx_issued" value="1">
                                <label class="form-check-label" for="rx_issued">Yes</label>
                            </div>
                        </div>

                        <!-- Action -->
                        <div class="col-md-6">
                            <label class="form-label">Action</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="action" id="action_refer_outlet" value="1">
                                    <label class="form-check-label" for="action_refer_outlet">Refer Internal</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="action" id="action_refer_clinic" value="2">
                                    <label class="form-check-label" for="action_refer_clinic">Refer External</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="action" id="action_end_process" value="3">
                                    <label class="form-check-label" for="action_end_process">End Process</label>
                                </div>
                            </div>
                        </div>

                        <!-- Follow Up Type -->
                        <div class="col-md-6">
                            <label class="form-label">Follow Up Type</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_type" id="followup_blood_review" value="1">
                                    <label class="form-check-label" for="followup_blood_review">Blood Test + Review</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="followup_type" id="followup_review_only" value="2">
                                    <label class="form-check-label" for="followup_review_only">Review Only</label>
                                </div>
                            </div>
                        </div>

                        <!-- Next Follow Up -->
                        <div class="col-md-6">
                            <label class="form-label">Next Follow Up</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_none" value="0">
                                    <label class="form-check-label" for="followup_none">None</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_1month" value="1">
                                    <label class="form-check-label" for="followup_1month">1 Month</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_3months" value="2">
                                    <label class="form-check-label" for="followup_3months">3 Months</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="next_followup" id="followup_6months" value="3">
                                    <label class="form-check-label" for="followup_6months">6 Months</label>
                                </div>
                            </div>
                        </div>

                        <!-- Next Follow Up Date -->
                        <div class="col-md-6">
                            <label class="form-label">Next Follow Up Date</label>
                            <input type="datetime-local" class="form-control" name="followup_date" id="followup_date">
                        </div>

                        <!-- Blood Test Required -->
                        <div class="col-md-6">
                            <label class="form-label">Blood Test Required</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="is_blood_test_required" id="blood_test_yes" value="1">
                                    <label class="form-check-label" for="blood_test_yes">Yes</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="is_blood_test_required" id="blood_test_no" value="0">
                                    <label class="form-check-label" for="blood_test_no">No</label>
                                </div>
                            </div>
                        </div>

                        <!-- Mode of Conversion -->
                        <div class="col-md-6">
                            <label class="form-label">Mode of Conversion</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_conversion" id="conversion_outlet" value="1">
                                    <label class="form-check-label" for="conversion_outlet">Outlet</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="mode_of_conversion" id="conversion_clinic" value="2">
                                    <label class="form-check-label" for="conversion_clinic">Clinic</label>
                                </div>
                            </div>
                        </div>

                        <!-- Referral To -->
                        <div class="col-md-6">
                            <label class="form-label">Referral To</label>
                            <select class="form-select" name="referral_to" id="referral_to">
                                <option value="">Select Outlet</option>
                                <?php foreach ($outletList as $outlet): ?>
                                <option value="<?php echo htmlspecialchars($outlet['code']); ?>"><?php echo htmlspecialchars($outlet['code'] . ' - ' . $outlet['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>

                        <!-- MyReferral Status -->
                        <div class="col-md-6">
                            <label class="form-label">MyReferral Status</label>
                            <div class="radio-group">
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="my_referral_status" id="myreferral_referred" value="1">
                                    <label class="form-check-label" for="myreferral_referred">Referred</label>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="radio" name="my_referral_status" id="myreferral_none" value="0">
                                    <label class="form-check-label" for="myreferral_none">None</label>
                                </div>
                            </div>
                        </div>

                        <!-- Remarks -->
                        <div class="col-md-12">
                            <label class="form-label">Remarks</label>
                            <textarea class="form-control" name="remarks" id="remarks" rows="3" placeholder="Enter any additional remarks"></textarea>
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

    <script>
    var EDIT_CONFIG = {
        consultCallId: <?php echo json_encode($consult_call_id); ?>,
        viewOnly: <?php echo json_encode($view_only === 'true'); ?>,
        staffId: <?php echo json_encode(isset($id_user) ? $id_user : ''); ?>,
        apiUrl: 'consultcall/api-jwt.php'
    };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="consultcall/js/edit.js?v=<?php echo time(); ?>"></script>
</body>
</html>
