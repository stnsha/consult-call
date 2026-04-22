<?php ob_start(); ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>ConsultCall - Access Control</title>
    <base href="/odb/">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css" rel="stylesheet">
    <link href="consultcall/css/style.css?v=<?php echo time(); ?>" rel="stylesheet">
    <style>
        .select2-container .select2-selection--single {
            height: 38px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
        }
        .select2-container--default .select2-selection--single .select2-selection__rendered {
            line-height: 36px;
            font-size: 14px;
            font-family: 'Inter', sans-serif;
            color: #212529;
            padding-left: 10px;
        }
        .select2-container--default .select2-selection--single .select2-selection__arrow {
            height: 36px;
        }
        .select2-dropdown {
            border: 1px solid #dee2e6;
            border-radius: 6px;
            font-size: 13px;
            font-family: 'Inter', sans-serif;
        }
        .select2-container--default .select2-results__option--highlighted[aria-selected] {
            background-color: #0d6efd;
        }
        .select2-search--dropdown .select2-search__field {
            font-size: 13px;
            font-family: 'Inter', sans-serif;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 4px 8px;
        }
        .staff-info-box {
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            padding: 12px 14px;
            font-size: 13px !important;
            display: none;
        }
        .staff-info-box *,
        .staff-info-box p,
        .staff-info-box strong,
        .staff-info-box span {
            font-size: 13px !important;
            margin-bottom: 4px;
        }
        /* Force all text left-aligned inside the container */
        .consultcall-container,
        .consultcall-container * {
            text-align: left !important;
        }
        /* Exceptions: badges and status values are allowed to be centered */
        .badge,
        .status-value {
            text-align: center !important;
        }

        .permission-list .form-check {
            padding-left: 1.75rem;
            margin-bottom: 6px;
        }
        .permission-list .form-check-label {
            font-size: 13px;
            cursor: pointer;
        }
        /* Restore radio button appearance overridden by ODB global CSS */
        .permission-list .form-check-input[type="radio"] {
            -webkit-appearance: radio !important;
            -moz-appearance: radio !important;
            appearance: radio !important;
            width: 1em !important;
            height: 1em !important;
            margin-top: 0.25em;
            border: 1px solid #adb5bd !important;
            background-color: #fff !important;
            cursor: pointer;
        }
        .permission-list .form-check-input[type="radio"]:checked {
            background-color: #0d6efd !important;
            border-color: #0d6efd !important;
        }
        .select2-container--default .select2-selection--multiple {
            border: 1px solid #dee2e6;
            border-radius: 6px;
            min-height: 38px;
            padding: 2px 4px;
        }
        .select2-container--default .select2-selection--multiple .select2-selection__rendered {
            padding: 0 4px;
        }
        .select2-container--default .select2-selection--multiple .select2-selection__choice {
            background-color: #e9ecef;
            border: 1px solid #ced4da;
            border-radius: 4px;
            padding: 1px 6px;
            font-size: 12px;
            font-family: 'Inter', sans-serif;
            color: #212529;
            margin: 3px 3px 3px 0;
        }
        .select2-container--default .select2-selection--multiple .select2-selection__choice__remove {
            color: #6c757d;
            margin-right: 4px;
        }
        .select2-container--default .select2-selection--multiple .select2-selection__choice__remove:hover {
            color: #dc3545;
        }
        .select2-container--default .select2-selection--multiple input.select2-search__field {
            font-size: 13px;
            font-family: 'Inter', sans-serif;
        }
    </style>
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
    header('Location: /odb/consultcall/index.php');
    exit;
}

$role_labels = array(
    0 => 'Normal User',
    1 => 'Super Admin',
    2 => 'Doctor',
    3 => 'Pharmacy',
    4 => 'HQ',
    5 => 'Outlet',
);

$role_badges = array(
    0 => 'bg-secondary',
    1 => 'bg-danger',
    2 => 'bg-primary',
    3 => 'bg-info text-dark',
    4 => 'bg-warning text-dark',
    5 => 'bg-success',
);

?>
<body>
    <div class="header" style="position: relative;">
        <b class="rtop"><b class="r1"></b><b class="r2"></b><b class="r3"></b><b class="r4"></b></b>
        <h1 class="headerH1"><img src='common/img/consultcall.png' width='20px'> ConsultCall Admin</h1>
        <b class="rbottom"><b class="r4"></b><b class="r3"></b><b class="r2"></b><b class="r1"></b></b>
    </div>
    <?php include('../navbar.php'); ?>
    <div class="consultcall-container mb-3">

        <div class="row mb-4">
            <div class="col-12">
                <h1 class="mb-1 fw-bold" style="font-size: 18px;">Access Control</h1>
                <p class="text-muted mb-0" style="font-size: 13px;">Manage staff roles for the ConsultCall module</p>
            </div>
        </div>

        <div class="row g-4">

            <!-- Left: Active roles table -->
            <div class="col-md-7">
                <div class="bento-card">
                    <p class="mb-3 text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 600;">Staff with Active Roles</p>
                    <div class="table-responsive">
                        <table class="table table-hover mb-0" style="font-size: 13px;">
                            <thead>
                                <tr>
                                    <th>Staff Name</th>
                                    <th>Department</th>
                                    <th>Role</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody id="active-staff-tbody">
                                <tr>
                                    <td colspan="4" class="text-center text-muted py-3">Loading...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <!-- Pagination -->
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-3" style="border-top: 1px solid #e9ecef;">
                        <span id="table-info" style="font-size: 12px; color: #6c757d;"></span>
                        <ul class="pagination pagination-sm mb-0" id="table-pagination"></ul>
                    </div>
                </div>
            </div>

            <!-- Right: Access control form -->
            <div class="col-md-5">
                <div class="bento-card">
                    <p class="mb-3 text-muted" style="font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 600;">Update Access</p>

                    <div id="form-alert" class="alert alert-dismissible fade show mb-3" role="alert" style="display:none !important; font-size: 13px;">
                        <span id="form-alert-msg"></span>
                        <button type="button" class="btn-close" onclick="dismissAlert()"></button>
                    </div>

                    <div class="mb-3">
                        <label class="form-label" style="font-size: 13px;">Staff Name</label>
                        <select id="staff-search" style="width:100%;"></select>
                    </div>

                    <div class="staff-info-box mb-3" id="staff-info">
                        <p><strong>Name:</strong> <span id="info-name"></span></p>
                        <p><strong>Department:</strong> <span id="info-dept"></span></p>
                        <p><strong>Status:</strong> <span id="info-status"></span></p>
                        <p class="mb-0"><strong>Current Role:</strong> <span id="info-role"></span></p>
                    </div>

                    <div class="mb-3 permission-list" id="permission-section" style="display:none;">
                        <label class="form-label" style="font-size: 13px;">Permission</label>
                        <?php foreach ($role_labels as $val => $label): ?>
                        <div class="form-check">
                            <input class="form-check-input" type="radio" name="permission"
                                id="perm-<?php echo $val; ?>" value="<?php echo $val; ?>">
                            <label class="form-check-label" for="perm-<?php echo $val; ?>">
                                <?php echo htmlspecialchars($label); ?> (<?php echo $val; ?>)
                            </label>
                        </div>
                        <?php endforeach; ?>
                    </div>

                    <div class="mb-3" id="outlet-section" style="display:none;">
                        <label class="form-label" style="font-size: 13px;">Outlet</label>
                        <div id="outlet-spinner" style="display:none; padding: 6px 2px;">
                            <span class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true"></span>
                            <span style="font-size:12px; color:#6c757d; margin-left:6px;">Loading...</span>
                        </div>
                        <select id="outlet-select" multiple style="width:100%;"></select>
                    </div>

                    <div class="d-flex justify-content-end" id="submit-section" style="display:none !important;">
                        <button type="button" class="btn btn-primary btn-sm" id="update-btn">Update Access</button>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
    var ROLE_LABELS = <?php echo json_encode($role_labels); ?>;
    var ROLE_BADGES = <?php echo json_encode($role_badges); ?>;
    var BACKEND_URL = 'consultcall/admin/backend.php';
    </script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
    <script>
    (function() {
        'use strict';

        var selectedStaffId = null;
        var allOutlets = [];
        var outletsReady = false;

        var outletSelect2Config = {
            placeholder: 'Select outlet(s)...',
            allowClear: true,
            width: '100%',
            templateResult: function(o) {
                if (!o.id) return o.text;
                return $('<span style="font-size:13px;font-family:Inter,sans-serif;">' + o.text + '</span>');
            },
            templateSelection: function(o) {
                return $('<span style="font-size:12px;font-family:Inter,sans-serif;">' + (o.text || o.id) + '</span>');
            }
        };

        function applyOutletSelect(selectedIds) {
            var $sel = $('#outlet-select');
            // Destroy any existing Select2 instance so we start clean
            if ($sel.hasClass('select2-hidden-accessible')) {
                $sel.select2('destroy');
            }
            // Set selected directly on <option> elements before Select2 reads the DOM
            $sel.find('option').prop('selected', false);
            $.each(selectedIds, function(i, id) {
                $sel.find('option[value="' + id + '"]').prop('selected', true);
            });
            // Initialize Select2 — it reads current selected state from the DOM
            $sel.select2(outletSelect2Config);
        }

        function loadOutlets() {
            $('#outlet-spinner').show();
            $.ajax({
                url: BACKEND_URL + '?action=getOutlets',
                type: 'GET',
                dataType: 'json',
                success: function(data) {
                    allOutlets = data || [];
                    var $sel = $('#outlet-select');
                    $sel.empty();
                    $.each(allOutlets, function(i, o) {
                        $sel.append(new Option(o.code + ' - ' + o.comp_name, String(o.id), false, false));
                    });
                    outletsReady = true;
                    $('#outlet-spinner').hide();
                },
                error: function() {
                    $('#outlet-spinner').hide();
                }
            });
        }

        // Initialize Select2 staff search
        $('#staff-search').select2({
            placeholder: 'Type staff name to search...',
            minimumInputLength: 2,
            allowClear: true,
            width: '100%',
            ajax: {
                url: BACKEND_URL + '?action=searchStaff',
                type: 'POST',
                dataType: 'json',
                delay: 250,
                data: function(params) {
                    return { search_term: params.term };
                },
                processResults: function(data) {
                    return {
                        results: $.map(data, function(staff) {
                            return { id: staff.id, text: staff.nama_staff, staff_data: staff };
                        })
                    };
                },
                cache: true
            },
            templateResult: function(data) {
                if (!data.id) return data.text;
                return $('<span style="font-size:13px;font-family:Inter,sans-serif;">' + data.text + '</span>');
            },
            templateSelection: function(data) {
                return $('<span style="font-size:13px;font-family:Inter,sans-serif;">' + data.text + '</span>');
            }
        });

        $('#staff-search').on('select2:select', function(e) {
            var staff = e.params.data.staff_data;
            showStaffInfo(staff);
        });

        $('#staff-search').on('select2:clear', function() {
            selectedStaffId = null;
            $('#staff-info').hide();
            $('#permission-section').hide();
            applyOutletSelect([]);
            $('#outlet-section').hide();
            $('#submit-section').css('display', 'none');
        });

        function showStaffInfo(staff) {
            selectedStaffId = staff.id;
            var role = staff.consult_call;
            var roleLabel = ROLE_LABELS[role] !== undefined ? ROLE_LABELS[role] + ' (' + role + ')' : 'Unknown';

            $('#info-name').text(staff.nama_staff);
            $('#info-dept').text(staff.department_name || '-');
            $('#info-status').text(staff.status_semasa || '-');
            $('#info-role').text(roleLabel);
            $('#staff-info').show();

            $('input[name="permission"][value="' + role + '"]').prop('checked', true);
            $('#permission-section').show();

            var outletStr = String(staff.outlet || '');
            var selectedIds = [];
            if (outletStr !== '') {
                $.each(outletStr.split(','), function(i, v) {
                    var id = parseInt(v, 10);
                    if (!isNaN(id) && id > 0) selectedIds.push(String(id));
                });
            }
            $('#outlet-section').show();
            applyOutletSelect(selectedIds);

            $('#submit-section').css('display', 'flex');
        }

        // Edit button from table pre-fills the form
        $(document).on('click', '.edit-btn', function() {
            var staffId   = $(this).data('staff-id');
            var staffName = $(this).data('staff-name');
            var staffDept = $(this).data('staff-dept');
            var staffRole = parseInt($(this).data('staff-role'), 10);

            selectedStaffId = staffId;

            // Inject into Select2
            var option = new Option(staffName, staffId, true, true);
            $('#staff-search').append(option).trigger('change');

            showStaffInfo({
                id: staffId,
                nama_staff: staffName,
                department_name: staffDept,
                status_semasa: $(this).data('staff-status') || '-',
                consult_call: staffRole,
                outlet: $(this).attr('data-staff-outlet') || ''
            });

            $('#access-form-area')[0] && $('#access-form-area')[0].scrollIntoView({ behavior: 'smooth' });
        });

        // Table pagination state
        var currentPage = 1;

        function loadActiveStaff(page) {
            currentPage = page || 1;
            $('#active-staff-tbody').html('<tr><td colspan="4" class="text-center text-muted py-3">Loading...</td></tr>');

            $.ajax({
                url: BACKEND_URL + '?action=getActiveStaff&page=' + currentPage,
                type: 'GET',
                dataType: 'json',
                success: function(response) {
                    if (!response.success) {
                        $('#active-staff-tbody').html('<tr><td colspan="4" class="text-center text-muted py-3">Failed to load.</td></tr>');
                        return;
                    }
                    renderTable(response.data);
                    renderPagination(response.page, response.total_pages, response.total, response.per_page);
                },
                error: function() {
                    $('#active-staff-tbody').html('<tr><td colspan="4" class="text-center text-muted py-3">Error loading data.</td></tr>');
                }
            });
        }

        function renderTable(data) {
            if (!data || data.length === 0) {
                $('#active-staff-tbody').html('<tr><td colspan="4" class="text-center text-muted py-3">No staff with active roles.</td></tr>');
                return;
            }
            var html = '';
            $.each(data, function(i, s) {
                var role      = s.consult_call;
                var roleLabel = ROLE_LABELS[role] !== undefined ? ROLE_LABELS[role] : 'Unknown';
                var roleBadge = ROLE_BADGES[role] !== undefined ? ROLE_BADGES[role] : 'bg-secondary';
                html += '<tr>' +
                    '<td>' + $('<span>').text(s.nama_staff).html() + '</td>' +
                    '<td class="text-muted">' + $('<span>').text(s.department_name).html() + '</td>' +
                    '<td><span class="badge ' + roleBadge + '">' + roleLabel + '</span></td>' +
                    '<td><button type="button" class="btn btn-sm btn-outline-secondary edit-btn"' +
                        ' data-staff-id="' + s.id + '"' +
                        ' data-staff-name="' + $('<span>').text(s.nama_staff).html() + '"' +
                        ' data-staff-dept="' + $('<span>').text(s.department_name).html() + '"' +
                        ' data-staff-status="' + $('<span>').text(s.status_semasa).html() + '"' +
                        ' data-staff-role="' + role + '"' +
                        ' data-staff-outlet="' + $('<span>').text(s.outlet || '').html() + '">Edit</button></td>' +
                    '</tr>';
            });
            $('#active-staff-tbody').html(html);
        }

        function renderPagination(page, totalPages, total, perPage) {
            var start = total === 0 ? 0 : (page - 1) * perPage + 1;
            var end   = Math.min(page * perPage, total);
            $('#table-info').text('Showing ' + start + ' to ' + end + ' of ' + total + ' entries');

            if (totalPages <= 1) {
                $('#table-pagination').html('');
                return;
            }

            var html = '';
            html += '<li class="page-item ' + (page === 1 ? 'disabled' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + (page - 1) + '">Previous</a></li>';

            for (var p = 1; p <= totalPages; p++) {
                html += '<li class="page-item ' + (p === page ? 'active' : '') + '">' +
                    '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
            }

            html += '<li class="page-item ' + (page === totalPages ? 'disabled' : '') + '">' +
                '<a class="page-link" href="#" data-page="' + (page + 1) + '">Next</a></li>';

            $('#table-pagination').html(html);
        }

        $(document).on('click', '#table-pagination a.page-link', function(e) {
            e.preventDefault();
            var page = parseInt($(this).data('page'), 10);
            if (!isNaN(page) && page >= 1) {
                loadActiveStaff(page);
            }
        });

        // Load table and outlets on page ready
        loadActiveStaff(1);
        loadOutlets();

        // Submit update
        $('#update-btn').on('click', function() {
            if (!selectedStaffId) return;

            var permission = $('input[name="permission"]:checked').val();
            if (permission === undefined) {
                showAlert('Please select a permission level.', false);
                return;
            }

            var btn = $(this);
            btn.prop('disabled', true).text('Saving...');

            var outletVal = $('#outlet-select').val();
            var outletIds = (outletVal && outletVal.length > 0) ? outletVal.join(',') : '';

            $.ajax({
                url: BACKEND_URL + '?action=updateAccess',
                type: 'POST',
                dataType: 'json',
                data: { staff_id: selectedStaffId, permission: permission, outlet_ids: outletIds },
                success: function(response) {
                    if (response.success) {
                        showAlert(response.message, true);
                        loadActiveStaff(currentPage);
                        $('#info-role').text(ROLE_LABELS[parseInt(permission, 10)] + ' (' + permission + ')');
                    } else {
                        showAlert(response.message || 'Update failed.', false);
                    }
                },
                error: function() {
                    showAlert('Request failed. Please try again.', false);
                },
                complete: function() {
                    btn.prop('disabled', false).text('Update Access');
                }
            });
        });

        function showAlert(msg, success) {
            var el = $('#form-alert');
            el.removeClass('alert-success alert-danger')
              .addClass(success ? 'alert-success' : 'alert-danger')
              .css('display', 'block');
            $('#form-alert-msg').text(msg);
        }

        function dismissAlert() {
            $('#form-alert').css('display', 'none');
        }
        window.dismissAlert = dismissAlert;

    })();
    </script>
</body>
</html>
