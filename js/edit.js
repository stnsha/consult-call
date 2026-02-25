/**
 * Telehealth Consultation Dashboard - Edit Page JavaScript
 * Handles form loading, population, submission, and conditional fields
 *
 * API field name reference:
 *   Consult Call: consent_call_status (0/1/2), consent_call_date, enrollment_type (1/2),
 *     scheduled_status (0-3), scheduled_call_date, handled_by, mode_of_consultation (0-3),
 *     closure_date, final_remarks
 *   Detail: diagnosis, treatment_plan, rx_issued (bool), action (1-3),
 *     consult_status (0-3), process_status (1-3), consulted_by, consult_date, remarks
 *   Follow-Up: followup_type (0-2), next_followup (0-3), followup_date,
 *     is_blood_test_required (bool), mode_of_conversion,
 *     followup_reminder (0-3), rescheduled_date, remarks
 */
(function() {
    'use strict';

    // Tracks the customer_id of the currently loaded consult call
    var currentCustomerId = null;

    // Tracks the IC number of the currently loaded customer
    var currentCustomerIc = null;

    // Tracks the IDs of the latest loaded detail and follow-up records
    var currentDetailId = null;
    var currentFollowUpId = null;

    // Consent status integer constants
    var CONSENT_PENDING = '0';
    var CONSENT_OBTAINED = '1';
    var CONSENT_REFUSED = '2';

    // Scheduled status integer constants
    var SCHEDULED_RESCHEDULE = '2';

    // Consult status integer constants
    var CONSULT_COMPLETED = '1';

    // Follow-up reminder integer constants
    var FOLLOWUP_REMINDER_RESCHEDULED = '2';

    // Tracks whether the Follow-up Checkpoint section is currently visible
    var isFollowUpCheckpointVisible = false;

    // Status label maps -- populated by loadStatusMaps() before first render
    var statusMaps = {
        consultStatuses: {},
        actions: {},
        followupTypes: {},
        nextFollowups: {}
    };

    /**
     * Make an API call to the consult call backend
     * @param {string} action The API action to perform
     * @param {object} data Additional data to send
     * @returns {Promise} Resolves with parsed JSON response
     */
    function apiCall(action, data) {
        var body = { action: action };
        if (data) {
            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    body[key] = data[key];
                }
            }
        }
        return fetch(EDIT_CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function(response) {
            return response.json();
        });
    }

    // -- Utility functions --

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = (value !== undefined && value !== null && value !== '') ? value : '';
        }
    }

    function setHtml(id, html) {
        var el = document.getElementById(id);
        if (el) {
            el.innerHTML = html;
        }
    }

    function setInputValue(name, value) {
        var el = document.querySelector('[name="' + name + '"]');
        if (el && value !== undefined && value !== null) {
            el.value = value;
        }
    }

    // Convert an ISO 8601 or date string to YYYY-MM-DD using the browser's local timezone.
    // Prevents off-by-one day errors caused by UTC-to-local conversion on read.
    function toDateValue(isoStr) {
        if (!isoStr) return '';
        var d = new Date(isoStr);
        if (isNaN(d.getTime())) {
            return String(isoStr).replace('T', ' ').split(' ')[0];
        }
        var y = d.getFullYear();
        var m = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + day;
    }

    // Convert an ISO 8601 or datetime string to "YYYY-MM-DDTHH:MM:SS" using the browser's local timezone.
    // Required format for type="datetime-local" inputs.
    function toDateTimeValue(isoStr) {
        if (!isoStr) return '';
        var d = new Date(isoStr);
        if (isNaN(d.getTime())) {
            return String(isoStr).replace(' ', 'T').replace('Z', '').split('.')[0];
        }
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, '0');
        var day = String(d.getDate()).padStart(2, '0');
        var h = String(d.getHours()).padStart(2, '0');
        var min = String(d.getMinutes()).padStart(2, '0');
        var sec = String(d.getSeconds()).padStart(2, '0');
        return y + '-' + mo + '-' + day + 'T' + h + ':' + min + ':' + sec;
    }

    function setSelectValue(name, value) {
        var el = document.querySelector('select[name="' + name + '"]');
        if (el && value !== undefined && value !== null) {
            el.value = String(value);
        }
    }

    function setRadioValue(name, value) {
        if (value === undefined || value === null) return;
        var radios = document.querySelectorAll('input[name="' + name + '"]');
        for (var i = 0; i < radios.length; i++) {
            radios[i].checked = (radios[i].value === String(value));
        }
    }

    function setCheckboxValue(name, value) {
        var el = document.querySelector('input[name="' + name + '"]');
        if (el) {
            el.checked = !!value;
        }
    }

    function getRadioValue(name) {
        var checked = document.querySelector('input[name="' + name + '"]:checked');
        return checked ? checked.value : '';
    }

    function getInputValue(name) {
        var el = document.querySelector('[name="' + name + '"]');
        return el ? el.value : '';
    }

    function getSelectValue(name) {
        var el = document.querySelector('select[name="' + name + '"]');
        return el ? el.value : '';
    }

    function getCheckboxValue(name) {
        var el = document.querySelector('input[name="' + name + '"]');
        return el ? el.checked : false;
    }

    // Build a map of { staffId: staffName } from the consulted_by select options
    function buildStaffMap() {
        var map = {};
        var select = document.querySelector('select[name="consulted_by"]');
        if (!select) return map;
        for (var i = 0; i < select.options.length; i++) {
            if (select.options[i].value) {
                map[select.options[i].value] = select.options[i].text;
            }
        }
        return map;
    }

    // Build a map of { value: labelText } from radio inputs in the form
    function buildRadioLabelMap(name) {
        var map = {};
        var radios = document.querySelectorAll('input[name="' + name + '"]');
        for (var i = 0; i < radios.length; i++) {
            var label = document.querySelector('label[for="' + radios[i].id + '"]');
            if (label) map[radios[i].value] = label.textContent.trim();
        }
        return map;
    }

    // -- Field error helpers --

    function showFieldError(name, message) {
        var errorId = 'field-error-' + name;
        var existing = document.getElementById(errorId);
        if (existing) {
            existing.textContent = message;
            return;
        }
        var el = document.querySelector('[name="' + name + '"]');
        if (!el) return;
        var errorDiv = document.createElement('div');
        errorDiv.id = errorId;
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        // For radio inputs, insert after the parent .radio-group div
        var insertAfter = el;
        if (el.type === 'radio') {
            var radioGroup = el.closest('.radio-group');
            if (radioGroup) insertAfter = radioGroup;
        }
        insertAfter.parentNode.insertBefore(errorDiv, insertAfter.nextSibling);
    }

    function clearFieldError(name) {
        var errorDiv = document.getElementById('field-error-' + name);
        if (errorDiv) errorDiv.parentNode.removeChild(errorDiv);
    }

    function clearAllErrors() {
        var errors = document.querySelectorAll('.field-error');
        for (var i = 0; i < errors.length; i++) {
            errors[i].parentNode.removeChild(errors[i]);
        }
    }

    // -- Form validation --

    function validateForm() {
        var valid = true;

        if (EDIT_CONFIG.currentStaffRole === 4) {
            var consentStatus = getRadioValue('consent_status');
            if (!consentStatus) {
                showFieldError('consent_status', 'Please select a consent status.');
                valid = false;
            } else {
                clearFieldError('consent_status');
            }

            if (consentStatus === '1') {
                var consentDate = getInputValue('consent_call_date');
                if (!consentDate) {
                    showFieldError('consent_call_date', 'Consent date is required.');
                    valid = false;
                } else { clearFieldError('consent_call_date'); }

                var scheduledDate = getInputValue('scheduled_call_date');
                if (!scheduledDate) {
                    showFieldError('scheduled_call_date', 'Scheduled consult date is required.');
                    valid = false;
                } else { clearFieldError('scheduled_call_date'); }

                var scheduledStatus = getRadioValue('scheduled_status');
                if (!scheduledStatus) {
                    showFieldError('scheduled_status', 'Please select a scheduled status.');
                    valid = false;
                } else {
                    clearFieldError('scheduled_status');
                    if (scheduledStatus === '2') {
                        var updatedDate = getInputValue('updated_scheduled_date');
                        if (!updatedDate) {
                            showFieldError('updated_scheduled_date', 'Updated scheduled date is required.');
                            valid = false;
                        } else { clearFieldError('updated_scheduled_date'); }
                    }
                }

                var handledBy = getSelectValue('handled_by');
                if (!handledBy) {
                    showFieldError('handled_by', 'Please select the person handling this call.');
                    valid = false;
                } else { clearFieldError('handled_by'); }

                var modeConsult = getRadioValue('mode_of_consultation');
                if (!modeConsult) {
                    showFieldError('mode_of_consultation', 'Please select a mode of consultation.');
                    valid = false;
                } else { clearFieldError('mode_of_consultation'); }
            }

            if (consentStatus === '2') {
                var refusalRemarks = getInputValue('refusal_remarks');
                if (!refusalRemarks || !refusalRemarks.trim()) {
                    showFieldError('refusal_remarks', 'Remarks are required when consent is refused.');
                    valid = false;
                } else { clearFieldError('refusal_remarks'); }
            }

            if (isFollowUpCheckpointVisible) {
                var checkpointFollowupDate = getInputValue('checkpoint_followup_date');
                if (!checkpointFollowupDate) {
                    showFieldError('checkpoint_followup_date', 'Follow-up date is required.');
                    valid = false;
                } else { clearFieldError('checkpoint_followup_date'); }

                var reminderStatus = getRadioValue('followup_reminder');
                if (!reminderStatus) {
                    showFieldError('followup_reminder', 'Please select a follow-up reminder status.');
                    valid = false;
                } else {
                    clearFieldError('followup_reminder');
                    if (reminderStatus === '2') {
                        var rescheduledDate = getInputValue('rescheduled_date');
                        if (!rescheduledDate) {
                            showFieldError('rescheduled_date', 'Rescheduled date is required.');
                            valid = false;
                        } else { clearFieldError('rescheduled_date'); }
                    }
                }
            }
        }

        if (EDIT_CONFIG.currentStaffRole === 2) {
            var consultDate = getInputValue('consult_date');
            if (!consultDate) {
                showFieldError('consult_date', 'Consult date is required.');
                valid = false;
            } else { clearFieldError('consult_date'); }

            var consultedBy = getSelectValue('consulted_by');
            if (!consultedBy) {
                showFieldError('consulted_by', 'Please select the consulted by person.');
                valid = false;
            } else { clearFieldError('consulted_by'); }

            var consultStatus = getRadioValue('consult_status');
            if (!consultStatus) {
                showFieldError('consult_status', 'Please select a consult status.');
                valid = false;
            } else { clearFieldError('consult_status'); }

            if (consultStatus === '1') {
                var diagnosis = getInputValue('diagnosis');
                if (!diagnosis || !diagnosis.trim()) {
                    showFieldError('diagnosis', 'Diagnosis is required.');
                    valid = false;
                } else { clearFieldError('diagnosis'); }

                var treatmentPlan = getInputValue('treatment_plan');
                if (!treatmentPlan || !treatmentPlan.trim()) {
                    showFieldError('treatment_plan', 'Treatment plan is required.');
                    valid = false;
                } else { clearFieldError('treatment_plan'); }

                var bloodTest = getRadioValue('is_blood_test_required');
                if (!bloodTest) {
                    showFieldError('is_blood_test_required', 'Please select whether a blood test is required.');
                    valid = false;
                } else { clearFieldError('is_blood_test_required'); }

                var followupType = getRadioValue('followup_type');
                if (followupType === '') {
                    showFieldError('followup_type', 'Please select a follow up type.');
                    valid = false;
                } else { clearFieldError('followup_type'); }

                var nextFollowup = getRadioValue('next_followup');
                if (!nextFollowup) {
                    showFieldError('next_followup', 'Please select a next follow up option.');
                    valid = false;
                } else {
                    clearFieldError('next_followup');
                    if (nextFollowup !== '0') {
                        var followupDate = getInputValue('followup_date');
                        if (!followupDate) {
                            showFieldError('followup_date', 'Follow up date is required.');
                            valid = false;
                        } else { clearFieldError('followup_date'); }
                    }
                }

                var modeConversion = getRadioValue('mode_of_conversion');
                if (!modeConversion) {
                    showFieldError('mode_of_conversion', 'Please select a mode of conversion.');
                    valid = false;
                } else { clearFieldError('mode_of_conversion'); }

                var action = getRadioValue('action');
                if (!action) {
                    showFieldError('action', 'Please select an action.');
                    valid = false;
                } else { clearFieldError('action'); }
            }
        }

        return valid;
    }

    // -- Conditional field handlers --

    /**
     * Show/hide conditional fields based on consent status integer value.
     * consent_obtained (data-condition) shows when value === '1' (Obtained)
     * consent_refused (data-condition) shows when value === '2' (Refused)
     * @param {string} value Consent status value as string ('0', '1', '2')
     */
    function handleConsentChange(value) {
        var consentFields = document.querySelectorAll('[data-condition="consent_obtained"]');
        for (var i = 0; i < consentFields.length; i++) {
            if (value === CONSENT_OBTAINED) {
                consentFields[i].classList.add('visible');
            } else {
                consentFields[i].classList.remove('visible');
            }
        }

        var refusedFields = document.querySelectorAll('[data-condition="consent_refused"]');
        for (var k = 0; k < refusedFields.length; k++) {
            if (value === CONSENT_REFUSED) {
                refusedFields[k].classList.add('visible');
            } else {
                refusedFields[k].classList.remove('visible');
            }
        }

        if (value !== CONSENT_OBTAINED) {
            var rescheduleFields = document.querySelectorAll('[data-condition="scheduled_reschedule"]');
            for (var j = 0; j < rescheduleFields.length; j++) {
                rescheduleFields[j].classList.remove('visible');
            }
        }
    }

    /**
     * Show/hide reschedule field based on scheduled status integer value.
     * scheduled_reschedule (data-condition) shows when value === '2' (Rescheduled)
     * @param {string} value Scheduled status value as string
     */
    function handleScheduledStatusChange(value) {
        var rescheduleFields = document.querySelectorAll('[data-condition="scheduled_reschedule"]');
        for (var i = 0; i < rescheduleFields.length; i++) {
            if (value === SCHEDULED_RESCHEDULE) {
                rescheduleFields[i].classList.add('visible');
            } else {
                rescheduleFields[i].classList.remove('visible');
            }
        }
    }

    /**
     * Show/hide detail sub-fields based on consult status.
     * consult_completed (data-condition) shows only when value === '1' (Completed).
     * Also syncs the Next Follow Up Date container visibility.
     * @param {string} value Consult status value as string
     */
    function handleConsultStatusChange(value) {
        var completedFields = document.querySelectorAll('[data-condition="consult_completed"]');
        for (var i = 0; i < completedFields.length; i++) {
            if (value === CONSULT_COMPLETED) {
                completedFields[i].classList.add('visible');
            } else {
                completedFields[i].classList.remove('visible');
            }
        }
        // Sync date container: show only if Completed AND a month is selected
        if (value === CONSULT_COMPLETED) {
            var checked = document.querySelector('input[name="next_followup"]:checked');
            handleNextFollowUpChange(checked ? checked.value : '0', false);
            // Re-evaluate action button based on current action selection
            var checkedAction = document.querySelector('input[name="action"]:checked');
            handleActionChange(checkedAction ? checkedAction.value : '');
        } else {
            var dateContainer = document.getElementById('next-followup-date-container');
            if (dateContainer) {
                dateContainer.style.display = 'none';
            }
            // Hide action button when consult is not completed
            handleActionChange('');
        }
    }

    /**
     * Show/hide the Create MyReferral button based on the selected action value.
     * Button is shown only when action = 1 (Refer Internal) or 2 (Refer External).
     * @param {string} value Action radio value as string
     */
    function handleActionChange(value) {
        var container = document.getElementById('myreferral-btn-container');
        if (!container) return;
        if (value === '1' || value === '2') {
            container.style.display = '';
            var btn = document.getElementById('myreferral-create-btn');
            if (btn) {
                var url = '/odb/referral/create.php';
                var params = [];
                if (currentCustomerIc) {
                    params.push('customer_ic=' + encodeURIComponent(currentCustomerIc));
                }
                params.push('referral_reason=' + encodeURIComponent(
                    'Blood Test for ConsultCall id #CC' + EDIT_CONFIG.consultCallId
                ));
                btn.href = url + '?' + params.join('&');
            }
        } else {
            container.style.display = 'none';
        }
    }

    /**
     * Show/hide and optionally auto-populate Next Follow Up Date.
     * Date is shown only when a month option (1/2/3) is selected.
     * Auto-populates the date when autoPopulate is true (user interaction).
     * @param {string} value next_followup radio value ('0'=None, '1'=1M, '2'=3M, '3'=6M)
     * @param {boolean} autoPopulate Whether to auto-fill the date field
     */
    function handleNextFollowUpChange(value, autoPopulate) {
        var container = document.getElementById('next-followup-date-container');
        if (!container) return;

        var monthsMap = { '1': 1, '2': 3, '3': 6 };
        var months = monthsMap[value];

        if (months) {
            container.style.display = '';
            if (autoPopulate) {
                var d = new Date();
                d.setMonth(d.getMonth() + months);
                var y = d.getFullYear();
                var mo = String(d.getMonth() + 1).padStart(2, '0');
                var day = String(d.getDate()).padStart(2, '0');
                setInputValue('followup_date', y + '-' + mo + '-' + day);
            }
        } else {
            container.style.display = 'none';
            setInputValue('followup_date', '');
        }
    }

    function loadStatusMaps() {
        var types = ['consult-statuses', 'actions', 'follow-up-types', 'next-follow-ups'];
        var keys  = ['consultStatuses',  'actions', 'followupTypes',    'nextFollowups'];
        var promises = [];
        for (var i = 0; i < types.length; i++) {
            promises.push(apiCall('get-statuses', { type: types[i] }));
        }
        return Promise.all(promises).then(function(results) {
            for (var j = 0; j < results.length; j++) {
                if (results[j].success && results[j].data) {
                    var map = {};
                    for (var k = 0; k < results[j].data.length; k++) {
                        map[String(results[j].data[k].id)] = results[j].data[k].label;
                    }
                    statusMaps[keys[j]] = map;
                }
            }
        });
    }

    function renderConsultationHistory(details, followUps) {
        var container = document.getElementById('consultation-history-container');
        if (!container) return;

        var staffMap = buildStaffMap();
        var modeConversionMap = buildRadioLabelMap('mode_of_conversion');

        // Build index-paired list and reverse for newest-first display.
        // All entries are included; pending entries (consult_status 0) show only
        // the blood test report without consultation fields.
        var pairs = [];
        for (var i = 0; i < (details || []).length; i++) {
            pairs.push({ detail: details[i], followUp: followUps[i] || null });
        }
        pairs.reverse();

        if (pairs.length === 0) {
            container.innerHTML = '<div class="text-muted small">No consultation history.</div>';
            return;
        }

        var accordionId = 'historyAccordion';
        var html = '<div class="accordion" id="' + accordionId + '">';

        for (var p = 0; p < pairs.length; p++) {
            var d  = pairs[p].detail;
            var fu = pairs[p].followUp;
            var isFirst = (p === 0);
            var isPending   = String(d.consult_status) === '0';
            var isCompleted = String(d.consult_status) === '1';

            // Build accordion header: always use created_at of the detail record
            var headerCreatedAt = d.created_at ? formatDate(d.created_at) : '';
            var headerLabel = isPending
                ? 'Pending Consultation'
                : (statusMaps.consultStatuses[String(d.consult_status)] || '');
            var headerParts = [];
            if (headerCreatedAt) headerParts.push(headerCreatedAt);
            if (headerLabel) headerParts.push(headerLabel);
            var headerText = headerParts.join(' \u2014 ');

            var headerId   = 'historyHeading'  + p;
            var collapseId = 'historyCollapse' + p;

            var btnClass      = isFirst ? 'accordion-button'              : 'accordion-button collapsed';
            var collapseClass = isFirst ? 'accordion-collapse collapse show' : 'accordion-collapse collapse';

            html += '<div class="accordion-item">';
            html += '<h2 class="accordion-header" id="' + headerId + '">';
            html += '<button class="' + btnClass + '" type="button"';
            html += ' data-bs-toggle="collapse" data-bs-target="#' + collapseId + '"';
            html += ' aria-expanded="' + (isFirst ? 'true' : 'false') + '"';
            html += ' aria-controls="' + collapseId + '">';
            html += escapeHtml(headerText);
            html += '</button></h2>';

            html += '<div id="' + collapseId + '" class="' + collapseClass + '"';
            html += ' aria-labelledby="' + headerId + '" data-bs-parent="#' + accordionId + '">';
            html += '<div class="accordion-body">';

            // Base info is always shown (blood test report, risk tier, clinical condition)
            html += renderAccordionBaseInfo(d);

            // Consultation section: only render when at least one consultation field has data
            var hasConsultData = !!(d.consult_date || d.consulted_by || d.diagnosis || d.treatment_plan || d.remarks);
            if (hasConsultData) {
                html += '<hr class="my-2">';
                html += '<div class="mb-1"><strong>Consultation</strong></div>';
                html += '<div class="row g-2">';
                html += '<div class="col-4">' + renderHistoryField('Consult Date', d.consult_date ? formatDate(d.consult_date) : null) + '</div>';
                html += '<div class="col-4">' + renderHistoryField('Consulted By', staffMap[String(d.consulted_by)] || null) + '</div>';
                html += '<div class="col-4">' + renderHistoryField('Consult Status', statusMaps.consultStatuses[String(d.consult_status)] || null) + '</div>';
                html += '</div>';
                if (isCompleted) {
                    html += renderHistoryField('Diagnosis', d.diagnosis || null);
                    html += renderHistoryField('Treatment Plan', d.treatment_plan || null);
                    html += renderHistoryField('Rx Issued', d.rx_issued ? 'Yes' : 'No');
                }
                html += renderHistoryField('Remarks', d.remarks || null);

                // Follow-up fields (2-column grid)
                if (isCompleted && fu) {
                    html += '<hr class="my-2">';
                    html += '<div class="mb-1"><strong>Follow-up</strong></div>';
                    html += '<div class="row g-2">';

                    html += '<div class="col-6">' + renderHistoryField('Blood Test Required', fu.is_blood_test_required ? 'Yes' : 'No') + '</div>';
                    html += '<div class="col-6">' + renderHistoryField('Follow Up Type', statusMaps.followupTypes[String(fu.followup_type)] || null) + '</div>';

                    html += '<div class="col-6">' + renderHistoryField('Next Follow Up', statusMaps.nextFollowups[String(fu.next_followup)] || null) + '</div>';
                    html += '<div class="col-6">' + renderHistoryField('Next Follow Up Date', (fu.next_followup && String(fu.next_followup) !== '0') ? formatDate(fu.followup_date) : null) + '</div>';

                    html += '<div class="col-6">' + renderHistoryField('Mode of Conversion', modeConversionMap[String(fu.mode_of_conversion)] || null) + '</div>';
                    html += '<div class="col-6">' + renderHistoryField('Action', statusMaps.actions[String(d.action)] || null) + '</div>';

                    html += '</div>'; // row
                }
            }

            html += '</div>'; // accordion-body
            html += '</div>'; // accordion-collapse
            html += '</div>'; // accordion-item
        }

        html += '</div>'; // accordion
        container.innerHTML = html;
    }

    function renderAccordionBaseInfo(detail) {
        var html = '<div class="mt-2">';

        // Blood test report
        html += '<div class="mb-2">';
        html += '<div class="history-label">Blood Test Report</div>';
        html += '<div class="history-value">';
        if (!detail.test_result_id || !detail.test_result) {
            html += '<span class="text-muted small">No blood test report linked.</span>';
        } else {
            html += '<div class="d-flex align-items-center gap-2">';
            html += '<span>' + escapeHtml(formatDate(detail.test_result.collected_date)) + '</span>';
            html += '<button type="button" class="btn btn-sm btn-outline-danger" onclick="openPdfReport(' + detail.test_result_id + ')">';
            html += '<i class="bi bi-file-earmark-pdf me-1"></i>View PDF</button>';
            html += '</div>';
        }
        html += '</div></div>';

        // Risk tier
        var cc = detail.clinical_condition || null;
        var riskTier = cc && cc.risk_tier !== null && cc.risk_tier !== undefined ? cc.risk_tier : null;
        html += '<div class="mb-2">';
        html += '<div class="history-label">Risk Tier</div>';
        html += '<div class="history-value">';
        if (riskTier !== null) {
            html += renderRiskTierBadge(riskTier);
        }
        html += '</div></div>';

        // Clinical condition
        html += renderHistoryField('Clinical Condition', cc ? (cc.description || null) : null);

        html += '</div>';
        return html;
    }

    function renderHistoryField(label, value) {
        return '<div class="mb-2">'
            + '<div class="history-label">' + escapeHtml(label) + '</div>'
            + '<div class="history-value">' + escapeHtml(value || '') + '</div>'
            + '</div>';
    }

    function toggleConsultationSection(visible) {
        var section = document.getElementById('consultation-section');
        if (section) {
            section.style.display = visible ? '' : 'none';
        }
    }

    function toggleEligibilitySection(visible) {
        var section = document.getElementById('eligibility-section');
        if (section) {
            section.style.display = visible ? '' : 'none';
        }
    }

    function disableEligibilitySection() {
        var section = document.getElementById('section-eligibility');
        if (!section) return;
        var fields = section.querySelectorAll('input, select, textarea');
        for (var i = 0; i < fields.length; i++) {
            fields[i].disabled = true;
        }
    }

    function toggleFollowUpCheckpointSection(visible) {
        isFollowUpCheckpointVisible = visible;
        var section = document.getElementById('followup-checkpoint-section');
        if (section) {
            section.style.display = visible ? '' : 'none';
        }
    }

    function disableFollowUpCheckpointSection() {
        var section = document.getElementById('section-followup-checkpoint');
        if (!section) return;
        var fields = section.querySelectorAll('input, select, textarea');
        for (var i = 0; i < fields.length; i++) {
            fields[i].disabled = true;
        }
    }

    function handleFollowUpReminderChange(value) {
        var fields = document.querySelectorAll('[data-condition="reminder_rescheduled"]');
        for (var i = 0; i < fields.length; i++) {
            if (value === FOLLOWUP_REMINDER_RESCHEDULED) {
                fields[i].classList.add('visible');
            } else {
                fields[i].classList.remove('visible');
            }
        }
        if (value !== FOLLOWUP_REMINDER_RESCHEDULED) {
            setInputValue('rescheduled_date', '');
        }
    }

    function initSectionCollapse() {
        var sectionHeaders = document.querySelectorAll('.section-header');
        for (var i = 0; i < sectionHeaders.length; i++) {
            sectionHeaders[i].addEventListener('click', function() {
                var sectionName = this.getAttribute('data-section');
                var sectionContent = document.getElementById('section-' + sectionName);
                if (sectionContent) {
                    this.classList.toggle('collapsed');
                    sectionContent.classList.toggle('collapsed');
                }
            });
        }
    }

    function initConditionalFields() {
        var consentRadios = document.querySelectorAll('input[name="consent_status"]');
        for (var j = 0; j < consentRadios.length; j++) {
            consentRadios[j].addEventListener('change', function() {
                handleConsentChange(this.value);
            });
        }

        var scheduledRadios = document.querySelectorAll('input[name="scheduled_status"]');
        for (var k = 0; k < scheduledRadios.length; k++) {
            scheduledRadios[k].addEventListener('change', function() {
                handleScheduledStatusChange(this.value);
            });
        }

        var consultRadios = document.querySelectorAll('input[name="consult_status"]');
        for (var l = 0; l < consultRadios.length; l++) {
            consultRadios[l].addEventListener('change', function() {
                handleConsultStatusChange(this.value);
            });
        }

        var nextFollowupRadios = document.querySelectorAll('input[name="next_followup"]');
        for (var n = 0; n < nextFollowupRadios.length; n++) {
            nextFollowupRadios[n].addEventListener('change', function() {
                handleNextFollowUpChange(this.value, true);
            });
        }

        var actionRadios = document.querySelectorAll('input[name="action"]');
        for (var p = 0; p < actionRadios.length; p++) {
            actionRadios[p].addEventListener('change', function() {
                handleActionChange(this.value);
            });
        }

        var followupReminderRadios = document.querySelectorAll('input[name="followup_reminder"]');
        for (var q = 0; q < followupReminderRadios.length; q++) {
            followupReminderRadios[q].addEventListener('change', function() {
                handleFollowUpReminderChange(this.value);
            });
        }
        handleFollowUpReminderChange('0');

        // Default: consent pending (0), consult sub-fields hidden, date hidden, action button hidden
        handleConsentChange(CONSENT_PENDING);
        handleConsultStatusChange('');
        handleNextFollowUpChange('0', false);
        handleActionChange('');
    }

    window.openCustomerModal = function() {
        if (!currentCustomerId) return;
        document.getElementById('customerViewer').src = '/odb/customer/index.php?id=' + currentCustomerId;
        var modal = new bootstrap.Modal(document.getElementById('customerModal'));
        modal.show();
    };

    window.openPdfReport = function(testResultId) {
        var btn = document.querySelector('[onclick="openPdfReport(' + testResultId + ')"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Loading...';
        }

        apiCall('get-pdf', { consult_call_id: EDIT_CONFIG.consultCallId, test_result_id: testResultId })
            .then(function(response) {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i>View PDF';
                }
                if (!response.success || !response.data || !response.data.pdf) {
                    alert(response.message || 'PDF not available.');
                    return;
                }
                document.getElementById('pdfViewer').src = 'data:application/pdf;base64,' + response.data.pdf;
                var pdfModal = new bootstrap.Modal(document.getElementById('pdfModal'));
                pdfModal.show();
            })
            .catch(function() {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="bi bi-file-earmark-pdf me-1"></i>View PDF';
                }
                alert('Failed to load PDF.');
            });
    };

    // -- Risk tier badge helper --
    // tier is an integer: 0 = no-mild, 1 = mild-moderate, 2 = moderate-severe, 3 = very severe/high

    var RISK_TIER_LABELS = [
        'No-Mild Risk',
        'Mild to Moderate Risk',
        'Moderate to Severe Risk',
        'Very Severe / High Risk'
    ];

    function renderRiskTierBadge(tier) {
        var t = parseInt(tier, 10);
        var label = (t >= 0 && t <= 3) ? RISK_TIER_LABELS[t] : 'Unknown';
        if (t === 0) {
            return '<span class="badge bg-success">' + escapeHtml(label) + '</span>';
        }
        if (t === 1) {
            return '<span class="badge bg-warning text-dark">' + escapeHtml(label) + '</span>';
        }
        if (t === 2) {
            return '<span class="badge" style="background-color:#fd7e14;color:#fff;">' + escapeHtml(label) + '</span>';
        }
        if (t === 3) {
            return '<span class="badge bg-danger">' + escapeHtml(label) + '</span>';
        }
        return '<span class="badge bg-secondary">' + escapeHtml(label) + '</span>';
    }

    // -- Data loading --

    /**
     * Load consult call data from API and populate the form.
     * Customer details are fetched separately from ODB customer table using customer_id.
     */
    function loadConsultCallData() {
        if (!EDIT_CONFIG.consultCallId) {
            setText('consult-call-id', 'No ID provided');
            return;
        }

        apiCall('get-consult-call', { id: EDIT_CONFIG.consultCallId }).then(function(result) {
            if (!result.success || !result.data) {
                setText('consult-call-id', 'Error loading data');
                console.error('Failed to load consult call:', result.message || 'Unknown error');
                return;
            }

            var data = result.data;

            // Fetch customer details from ODB using customer_id
            if (data.customer_id) {
                apiCall('get-customer', { customer_id: data.customer_id }).then(function(custResult) {
                    if (custResult.success && custResult.data) {
                        populateForm(data, custResult.data);
                    } else {
                        populateForm(data, {});
                    }
                }).catch(function() {
                    populateForm(data, {});
                });
            } else {
                populateForm(data, {});
            }
        }).catch(function(err) {
            setText('consult-call-id', 'Error loading data');
            console.error('Failed to load consult call:', err);
        });
    }

    /**
     * Populate all form fields from API response data.
     * Customer fields come from ODB customer table (separate API call).
     * All status fields are integer IDs.
     * @param {object} data Consult call data from API
     * @param {object} customer Customer data from ODB customer table
     */
    function populateForm(data, customer) {
        // Header ID badge
        setText('consult-call-id', '#CC' + data.id);

        // Store customer_id and IC, and show the View Customer button if available
        currentCustomerId = data.customer_id || null;
        currentCustomerIc = customer.ic || null;
        var btnViewCustomer = document.getElementById('btn-view-customer');
        if (btnViewCustomer) {
            btnViewCustomer.style.display = currentCustomerId ? '' : 'none';
        }

        // Customer details (from ODB customer table)
        customer = customer || {};
        setText('patient-name', customer.name);
        setText('patient-icno', customer.ic);
        setText('patient-phone', customer.phone);
        setText('patient-email', customer.email);
        setText('patient-address', customer.address);
        setText('patient-age', customer.age);
        setText('patient-gender', customer.gender);

        // -- Consult Call level fields (integer IDs) --

        // Consent status (0=Pending, 1=Obtained, 2=Refused)
        var consentStatus = (data.consent_call_status !== undefined && data.consent_call_status !== null)
            ? String(data.consent_call_status) : CONSENT_PENDING;
        setRadioValue('consent_status', consentStatus);
        handleConsentChange(consentStatus);

        // Consultation Details section is only visible when consent was already saved as Obtained
        toggleConsultationSection(String(data.consent_call_status) === CONSENT_OBTAINED);

        // Consent obtained fields
        if (data.consent_call_date) {
            setInputValue('consent_call_date', toDateValue(data.consent_call_date));
        }
        if (data.scheduled_call_date) {
            setInputValue('scheduled_call_date', toDateValue(data.scheduled_call_date));
        }
        if (data.scheduled_status !== undefined && data.scheduled_status !== null) {
            var scheduledVal = String(data.scheduled_status);
            setRadioValue('scheduled_status', scheduledVal);
            handleScheduledStatusChange(scheduledVal);
        }
        if (data.updated_scheduled_date) {
            setInputValue('updated_scheduled_date', toDateValue(data.updated_scheduled_date));
        }
        if (data.handled_by) {
            setSelectValue('handled_by', data.handled_by);
        }
        // Auto-select current staff for Handled By if no saved value and user is HQ (role 4)
        if (!data.handled_by && EDIT_CONFIG.currentStaffRole === 4 && EDIT_CONFIG.currentStaffId) {
            setSelectValue('handled_by', String(EDIT_CONFIG.currentStaffId));
        }
        if (data.mode_of_consultation !== undefined && data.mode_of_consultation !== null) {
            setRadioValue('mode_of_consultation', String(data.mode_of_consultation));
        }

        // Consent refused fields
        if (data.final_remarks) {
            setInputValue('refusal_remarks', data.final_remarks);
        }

        // -- Detail and follow-up IDs (for update-vs-create logic on submit) --
        // Form fields are intentionally left blank; submitted data is read-only in history.
        var details = data.details || [];
        currentDetailId = null;
        if (details.length > 0) {
            currentDetailId = details[details.length - 1].id || null;
        }

        // Auto-select current staff as Consulted By for Doctor role (role 2)
        if (EDIT_CONFIG.currentStaffRole === 2 && EDIT_CONFIG.currentStaffId) {
            setSelectValue('consulted_by', String(EDIT_CONFIG.currentStaffId));
        }

        var followUps = data.follow_ups || [];
        currentFollowUpId = null;
        if (followUps.length > 0) {
            currentFollowUpId = followUps[followUps.length - 1].id || null;
        }

        // Show Follow-up Checkpoint section only when the latest follow-up has a type that is not None (0)
        var latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : null;
        var hasActiveFollowUp = latestFollowUp && String(latestFollowUp.followup_type) !== '0';

        toggleFollowUpCheckpointSection(!!hasActiveFollowUp);

        // Lock eligibility section once the consultation has been completed
        var latestDetail = details.length > 0 ? details[details.length - 1] : null;
        if (latestDetail && String(latestDetail.consult_status) === '1') {
            disableEligibilitySection();
        }

        // Populate Follow-up Checkpoint fields if visible
        if (hasActiveFollowUp && latestFollowUp) {
            var reminderVal = (latestFollowUp.followup_reminder !== undefined && latestFollowUp.followup_reminder !== null)
                ? String(latestFollowUp.followup_reminder) : '0';
            setRadioValue('followup_reminder', reminderVal);
            handleFollowUpReminderChange(reminderVal);

            // Populate follow-up date and lock the minimum to the originally scheduled date
            if (latestFollowUp.followup_date) {
                var originalFollowupDate = toDateValue(latestFollowUp.followup_date);
                setInputValue('checkpoint_followup_date', originalFollowupDate);
                var dateEl = document.getElementById('checkpoint_followup_date');
                if (dateEl) {
                    dateEl.min = originalFollowupDate;
                }
            }

            if (latestFollowUp.rescheduled_date) {
                setInputValue('rescheduled_date', toDateValue(latestFollowUp.rescheduled_date));
            }

            // Lock checkpoint section once the reminder has been marked completed
            if (reminderVal === '1') {
                disableFollowUpCheckpointSection();
            }
        }

        // Render read-only consultation history accordion
        renderConsultationHistory(data.details || [], data.follow_ups || []);

        // Apply view-only mode
        if (EDIT_CONFIG.viewOnly) {
            disableAllFormFields();
        }
    }

    /**
     * Disable all form inputs, selects, textareas and hide save button
     */
    function disableAllFormFields() {
        var form = document.getElementById('editPatientForm');
        if (!form) return;

        var inputs = form.querySelectorAll('input, select, textarea');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].disabled = true;
        }

        var saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.style.display = 'none';
        }
    }

    /**
     * Parse a radio/input value as integer, or return null if empty
     * @param {string} val Form value string
     * @returns {number|null}
     */
    function toIntOrNull(val) {
        if (val === '' || val === undefined || val === null) return null;
        var n = parseInt(val, 10);
        return isNaN(n) ? null : n;
    }

    /**
     * Initialize form submission handler.
     * Sends consult call level fields via update-consult-call.
     * Detail and follow-up fields are sent separately to their respective endpoints.
     */
    function initFormSubmission() {
        var form = document.getElementById('editPatientForm');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            if (EDIT_CONFIG.viewOnly) return;

            clearAllErrors();
            if (!validateForm()) {
                return;
            }

            var saveBtn = document.getElementById('saveBtn');
            var originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Saving...';

            // Consult call level data (matches API 2.5 Update fields)
            var consultCallData = {
                consent_call_status: toIntOrNull(getRadioValue('consent_status')),
                consent_call_date: getInputValue('consent_call_date') || null,
                scheduled_status: toIntOrNull(getRadioValue('scheduled_status')),
                scheduled_call_date: getInputValue('scheduled_call_date') || null,
                updated_scheduled_date: getInputValue('updated_scheduled_date') || null,
                handled_by: toIntOrNull(getSelectValue('handled_by')),
                mode_of_consultation: toIntOrNull(getRadioValue('mode_of_consultation')),
                final_remarks: getInputValue('refusal_remarks') || null
            };

            // Detail level data (matches API 3.1 Create Detail fields)
            var detailData = {
                consult_date: getInputValue('consult_date') || null,
                consulted_by: toIntOrNull(getSelectValue('consulted_by')),
                consult_status: toIntOrNull(getRadioValue('consult_status')),
                diagnosis: getInputValue('diagnosis') || null,
                treatment_plan: getInputValue('treatment_plan') || null,
                rx_issued: getCheckboxValue('rx_issued'),
                action: toIntOrNull(getRadioValue('action')),
                remarks: getInputValue('remarks') || null
            };

            // Follow-up level data (matches API 4.1 Create Follow-Up fields)
            var followUpData = {
                followup_type: toIntOrNull(getRadioValue('followup_type')),
                next_followup: toIntOrNull(getRadioValue('next_followup')),
                followup_date: getInputValue('followup_date') || null,
                is_blood_test_required: getRadioValue('is_blood_test_required') === '1',
                mode_of_conversion: toIntOrNull(getRadioValue('mode_of_conversion'))
            };

            // Only HQ (role 4) can update consult call eligibility fields
            var consultCallPromise;
            if (EDIT_CONFIG.currentStaffRole === 4) {
                consultCallPromise = apiCall('update-consult-call', {
                    id: EDIT_CONFIG.consultCallId,
                    data: consultCallData
                });
            } else {
                consultCallPromise = Promise.resolve({ success: true });
            }

            consultCallPromise.then(function(result) {
                if (!result.success) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                    alert('Failed to save consult call: ' + (result.message || 'Unknown error'));
                    // Throw to skip the next .then() so success is not shown
                    throw new Error('__handled__');
                }

                // Only Doctor (role 2) can save Consultation Details and Follow-Up fields
                var promises = [];

                // HQ (role 4) saves Follow-up Checkpoint to the existing follow-up record
                if (EDIT_CONFIG.currentStaffRole === 4 && isFollowUpCheckpointVisible && currentFollowUpId) {
                    promises.push(apiCall('update-follow-up', {
                        consult_call_id: EDIT_CONFIG.consultCallId,
                        follow_up_id: currentFollowUpId,
                        data: {
                            followup_reminder: toIntOrNull(getRadioValue('followup_reminder')),
                            followup_date: getInputValue('checkpoint_followup_date') || null,
                            rescheduled_date: getInputValue('rescheduled_date') || null
                        }
                    }));
                }

                if (EDIT_CONFIG.currentStaffRole === 2) {
                    var hasDetail = detailData.consult_date || detailData.diagnosis ||
                        detailData.treatment_plan || detailData.consult_status !== null;

                    // Only create a follow-up when the consultation is completed (status 1)
                    // and the user has entered meaningful follow-up data
                    var hasFollowUp = detailData.consult_status === 1 && (
                        followUpData.followup_type !== null ||
                        followUpData.next_followup !== null ||
                        followUpData.followup_date
                    );

                    if (hasDetail) {
                        if (currentDetailId) {
                            promises.push(apiCall('update-detail', {
                                consult_call_id: EDIT_CONFIG.consultCallId,
                                detail_id: currentDetailId,
                                data: detailData
                            }));
                        } else {
                            promises.push(apiCall('create-detail', {
                                consult_call_id: EDIT_CONFIG.consultCallId,
                                data: detailData
                            }));
                        }
                    }

                    if (hasFollowUp) {
                        if (currentFollowUpId) {
                            promises.push(apiCall('update-follow-up', {
                                consult_call_id: EDIT_CONFIG.consultCallId,
                                follow_up_id: currentFollowUpId,
                                data: followUpData
                            }));
                        } else {
                            promises.push(apiCall('create-follow-up', {
                                consult_call_id: EDIT_CONFIG.consultCallId,
                                data: followUpData
                            }));
                        }
                    }
                }

                if (promises.length > 0) {
                    return Promise.all(promises);
                }
                return [];
            }).then(function(results) {
                results = results || [];
                for (var i = 0; i < results.length; i++) {
                    if (!results[i].success) {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = originalText;
                        alert('Failed to save: ' + (results[i].message || 'Unknown error'));
                        return;
                    }
                }
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                alert('Changes saved successfully.');
                window.location.reload();
            }).catch(function(err) {
                // '__handled__' errors have already shown an alert; skip re-alerting
                if (err && err.message === '__handled__') {
                    return;
                }
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                alert('Error saving changes. Please try again.');
                console.error('Save error:', err);
            });
        });
    }

    // -- Initialization --

    document.addEventListener('DOMContentLoaded', function() {
        initSectionCollapse();
        initConditionalFields();
        initFormSubmission();
        loadStatusMaps().then(function() {
            loadConsultCallData();
        });
    });
})();
