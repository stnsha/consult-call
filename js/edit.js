/**
 * Telehealth Consultation Dashboard - Edit Page JavaScript
 * Handles form loading, population, submission, and conditional fields
 *
 * API field name reference:
 *   Consult Call: consent_call_status (0/1/2/3), reason, consent_call_date, enrollment_type (1/2),
 *     scheduled_status (0-3), scheduled_call_date, handled_by,
 *     closure_date, final_remarks
 *   Detail: diagnosis, treatment_plan, rx_issued (bool), action (1-3),
 *     consultation_type (1=New Case, 2=Follow-Up), consult_status (0-3),
 *     process_status (1-3), consulted_by, consult_date, remarks
 *   Follow-Up: followup_type (0-2), next_followup (0-3), followup_date,
 *     mode_of_conversion, followup_reminder (0-3), rescheduled_date, remarks
 *     (is_blood_test_required removed from the form; column kept, nullable, always sent null)
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

    // Detail ID targeted by the header Process Status pill toggle -- always the
    // latest detail record, independent of currentDetailId's update-vs-create semantics.
    var headerProcessStatusDetailId = null;

    // Tracks the last confirmed consult status so the radio can be reverted
    // when the doctor declines the "Completed" confirmation dialog.
    var prevConsultStatus = '';

    // Preserves the handled_by value loaded from the API so it is not lost
    // when the staff does not exist in the local dropdown options.
    var originalHandledBy = null;
    // Doctor-specific follow-up ID: null when latest detail is completed (forces create)
    var doctorFollowUpId = null;

    // Base date for next follow-up auto-population. Set to the current follow-up's
    // scheduled date when a follow-up consultation is being entered, so that the
    // "add N months" calculation starts from the scheduled visit date, not today.
    var followUpBaseDateStr = null;

    // TODO [DEPLOY]: clinical_condition_id and test_result_id are required (non-nullable) on
    // consult_call_details. For follow-up consultations these are carried over from the
    // previous detail as a testing workaround. Before go-live, either (a) have the UI
    // collect these values explicitly, or (b) migrate the columns to nullable.
    var previousDetailClinicalConditionId = null;
    var previousDetailTestResultId = null;

    // Consent status integer constants
    var CONSENT_PENDING = '0';
    var CONSENT_OBTAINED = '1';
    var CONSENT_REFUSED = '2';
    var CONSENT_OTHERS = '3';

    // Predefined Reason dropdown options (values match the exact text stored in
    // the "reason" column, and are self-explanatory enough that Remarks becomes
    // optional). Blank (no reason chosen yet) or "Others" both keep Remarks
    // required, since neither one explains itself on its own.
    var REASON_PREDEFINED = [
        'On Prescribed Medication/Follow-Up',
        'Unreachable',
        'Not Keen',
        'Foreign Number'
    ];

    // Scheduled status integer constants
    var SCHEDULED_RESCHEDULE = '2';

    // Consult status integer constants
    var CONSULT_PENDING = '0';
    var CONSULT_COMPLETED = '1';
    var CONSULT_NO_SHOW = '2';
    var CONSULT_CANCELLED = '3';

    // True when the current doctor has already claimed the active detail (consulted_by set)
    // but has not yet saved consult_status as completed. Used to skip the confirmation dialog
    // on the subsequent click to Completed (they already confirmed the initial claim).
    var isDetailClaimedByCurrentDoctor = false;

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

                var handledBy = getSelectValue('handled_by') || originalHandledBy;
                if (!handledBy) {
                    showFieldError('handled_by', 'Please select the person handling this call.');
                    valid = false;
                } else { clearFieldError('handled_by'); }
            }

            if (consentStatus === CONSENT_REFUSED || consentStatus === CONSENT_OTHERS) {
                // Remarks is required unless the Reason dropdown has a specific
                // predefined value -- blank or "Others" both still require it.
                var remarksRequired = REASON_PREDEFINED.indexOf(getSelectValue('reason')) === -1;
                var refusalRemarks = getInputValue('refusal_remarks');
                if (remarksRequired && (!refusalRemarks || !refusalRemarks.trim())) {
                    showFieldError('refusal_remarks', 'Remarks are required.');
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

            var consultationType = getRadioValue('consultation_type');
            if (!consultationType) {
                showFieldError('consultation_type', 'Please select a consultation type.');
                valid = false;
            } else { clearFieldError('consultation_type'); }

            if (consultStatus === '1') {
                var documentation = getInputValue('documentation');
                if (!documentation || !documentation.trim()) {
                    showFieldError('documentation', 'Documentation is required.');
                    valid = false;
                } else { clearFieldError('documentation'); }

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

            if (consultStatus === CONSULT_NO_SHOW || consultStatus === CONSULT_CANCELLED) {
                var terminalRemarks = getInputValue('remarks');
                if (!terminalRemarks || !terminalRemarks.trim()) {
                    showFieldError('remarks', 'Remarks are required for No-show or Cancelled.');
                    valid = false;
                } else { clearFieldError('remarks'); }
            }
        }

        return valid;
    }

    // -- Conditional field handlers --

    /**
     * Show/hide conditional fields based on consent status integer value.
     * consent_obtained (data-condition) shows when value === '1' (Obtained)
     * consent_refused (data-condition) and consent_reason (data-condition) show when
     * value === '2' (Refused) or '3' (Others) -- Remarks is required in both cases.
     * @param {string} value Consent status value as string ('0', '1', '2', '3')
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

        var showReason = (value === CONSENT_REFUSED || value === CONSENT_OTHERS);

        var refusedFields = document.querySelectorAll('[data-condition="consent_refused"]');
        for (var k = 0; k < refusedFields.length; k++) {
            if (showReason) {
                refusedFields[k].classList.add('visible');
            } else {
                refusedFields[k].classList.remove('visible');
            }
        }

        var reasonFields = document.querySelectorAll('[data-condition="consent_reason"]');
        for (var m = 0; m < reasonFields.length; m++) {
            if (showReason) {
                reasonFields[m].classList.add('visible');
            } else {
                reasonFields[m].classList.remove('visible');
            }
        }
        // Keep the Remarks required-mark in sync with the current Reason value
        // whenever consent status changes (e.g. on initial load).
        handleReasonChange(getSelectValue('reason'));

        if (value !== CONSENT_OBTAINED) {
            var rescheduleFields = document.querySelectorAll('[data-condition="scheduled_reschedule"]');
            for (var j = 0; j < rescheduleFields.length; j++) {
                rescheduleFields[j].classList.remove('visible');
            }
        }
    }

    /**
     * Toggle the red required-mark next to the Remarks label based on the Reason
     * dropdown value. Remarks stays required (mark shown) unless a specific
     * predefined, self-explanatory reason is chosen.
     * @param {string} value Reason dropdown value
     */
    function handleReasonChange(value) {
        var requiredMark = document.getElementById('refusal_remarks_required_mark');
        if (requiredMark) {
            requiredMark.style.display = (REASON_PREDEFINED.indexOf(value) === -1) ? '' : 'none';
        }
    }

    /**
     * Resolve the value to submit for the "reason" field.
     * @returns {string|null}
     */
    function getReasonValue() {
        return getSelectValue('reason') || null;
    }

    /**
     * Populate the Reason dropdown from a saved reason string.
     * @param {string|null} reason
     */
    function populateReasonField(reason) {
        setSelectValue('reason', reason || '');
        handleReasonChange(reason || '');
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
        // Cascade: appointment cancelled → consent becomes Refused, consult_status becomes Cancelled.
        // Do NOT call handleConsentChange('2') — that hides consent_obtained fields (Scheduled
        // Status, Handled By) which must stay visible as context for the cancelled appointment.
        // Instead, explicitly keep those fields visible and only add the Remarks/Reason fields.
        if (value === '3') {
            setRadioValue('consent_status', '2');
            var coFields = document.querySelectorAll('[data-condition="consent_obtained"]');
            for (var ci = 0; ci < coFields.length; ci++) {
                coFields[ci].classList.add('visible');
            }
            var crFields = document.querySelectorAll('[data-condition="consent_refused"]');
            for (var cr = 0; cr < crFields.length; cr++) {
                crFields[cr].classList.add('visible');
            }
            var crReasonFields = document.querySelectorAll('[data-condition="consent_reason"]');
            for (var crr = 0; crr < crReasonFields.length; crr++) {
                crReasonFields[crr].classList.add('visible');
            }
            setRadioValue('consult_status', CONSULT_CANCELLED);
            handleConsultStatusChange(CONSULT_CANCELLED);
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
        // Claim the detail record for this doctor as soon as Completed is selected.
        // This prevents a second doctor from editing the same pending record.
        // Safe to re-run: if consulted_by is already this doctor the backend is a no-op.
        if (value === CONSULT_COMPLETED && currentDetailId && EDIT_CONFIG.currentStaffId) {
            apiCall('update-detail', {
                consult_call_id: EDIT_CONFIG.consultCallId,
                detail_id: currentDetailId,
                data: {
                    consulted_by: parseInt(EDIT_CONFIG.currentStaffId, 10)
                }
            }).then(function(result) {
                if (!result.success) {
                    // Claim rejected (another doctor already owns this record). Revert the UI.
                    var allCR = document.querySelectorAll('input[name="consult_status"]');
                    for (var cri = 0; cri < allCR.length; cri++) { allCR[cri].checked = false; }
                    prevConsultStatus = '';
                    handleConsultStatusChange('');
                    alert(result.message || 'This consultation has already been assigned to another doctor.');
                }
            }).catch(function() {
                var allCR = document.querySelectorAll('input[name="consult_status"]');
                for (var cri = 0; cri < allCR.length; cri++) { allCR[cri].checked = false; }
                prevConsultStatus = '';
                handleConsultStatusChange('');
                alert('Failed to claim this consultation. Please try again.');
            });
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
            handleActionChange('');
            // No Show and Cancelled default process_status to Closed and lock it.
            // Cancelled also updates consent radio to Refused for visual feedback.
            if (value === CONSULT_NO_SHOW || value === CONSULT_CANCELLED) {
                setProcessStatusRadio('3', true);
                if (value === CONSULT_CANCELLED) {
                    setRadioValue('consent_status', '2');
                }
            }
        }
    }

    /**
     * Set the process_status radio to a given value and optionally disable both options.
     * When value is null: enables the radios and defaults to Active (1) if nothing is selected.
     * Used by handleActionChange and handleConsultStatusChange to reflect auto-close rules.
     * @param {string|null} value Radio value to check ('1' or '3'), or null to enable/default
     * @param {boolean} disable Whether to disable the radio inputs
     */
    function setProcessStatusRadio(value, disable) {
        var radios = document.querySelectorAll('input[name="process_status"]');
        if (!radios.length) return;
        var i;
        if (value !== null) {
            for (i = 0; i < radios.length; i++) {
                radios[i].checked = (radios[i].value === value);
                radios[i].disabled = !!disable;
            }
        } else {
            var anyChecked = false;
            for (i = 0; i < radios.length; i++) {
                radios[i].disabled = false;
                if (radios[i].checked) { anyChecked = true; }
            }
            if (!anyChecked) {
                for (i = 0; i < radios.length; i++) {
                    if (radios[i].value === '1') { radios[i].checked = true; break; }
                }
            }
        }
    }

    /**
     * Process Status pill toggle in the page header. Independent of the Consultation
     * Details form -- saves immediately on click via its own update-detail call,
     * rather than participating in the main form's submit/validation flow.
     */

    function setHeaderProcessStatusActive(value) {
        var btns = document.querySelectorAll('#header-process-status .segmented-toggle-btn');
        for (var i = 0; i < btns.length; i++) {
            if (btns[i].getAttribute('data-value') === String(value)) {
                btns[i].classList.add('active');
            } else {
                btns[i].classList.remove('active');
            }
        }
    }

    function showHeaderProcessStatus(detailId, processStatus) {
        var container = document.getElementById('header-process-status');
        if (!container || !detailId) return;
        headerProcessStatusDetailId = detailId;
        setHeaderProcessStatusActive(processStatus !== undefined && processStatus !== null ? processStatus : 1);
        container.style.display = '';
    }

    function hideHeaderProcessStatus() {
        var container = document.getElementById('header-process-status');
        if (container) container.style.display = 'none';
        headerProcessStatusDetailId = null;
    }

    function saveHeaderProcessStatus(newValue) {
        var container = document.getElementById('header-process-status');
        if (!container || !headerProcessStatusDetailId) return;
        var btns = container.querySelectorAll('.segmented-toggle-btn');
        var previousActive = container.querySelector('.segmented-toggle-btn.active');
        var previousValue = previousActive ? previousActive.getAttribute('data-value') : '1';
        if (previousValue === String(newValue)) return;

        var i;
        for (i = 0; i < btns.length; i++) { btns[i].disabled = true; }
        setHeaderProcessStatusActive(newValue);

        apiCall('update-detail', {
            consult_call_id: EDIT_CONFIG.consultCallId,
            detail_id: headerProcessStatusDetailId,
            data: { process_status: parseInt(newValue, 10) }
        }).then(function(result) {
            for (i = 0; i < btns.length; i++) { btns[i].disabled = false; }
            if (!result.success) {
                setHeaderProcessStatusActive(previousValue);
                alert(result.message || 'Failed to update process status.');
            }
        }).catch(function() {
            for (i = 0; i < btns.length; i++) { btns[i].disabled = false; }
            setHeaderProcessStatusActive(previousValue);
            alert('Network error. Please try again.');
        });
    }

    function initHeaderProcessStatus() {
        var container = document.getElementById('header-process-status');
        if (!container) return;
        var btns = container.querySelectorAll('.segmented-toggle-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].addEventListener('click', function() {
                if (this.disabled) return;
                saveHeaderProcessStatus(this.getAttribute('data-value'));
            });
        }
    }

    /**
     * Show or hide the End Process + Active warning message.
     * Warning appears when action = End Process (3) and process_status = Active (1).
     */
    function checkEndProcessWarning() {
        var warning = document.getElementById('end-process-warning');
        if (!warning) return;
        var action = toIntOrNull(getRadioValue('action'));
        var ps = toIntOrNull(getRadioValue('process_status'));
        warning.style.display = (action === 3 && ps === 1) ? '' : 'none';
    }

    function checkClosedProcessWarning() {
        var warning = document.getElementById('closed-no-end-process-warning');
        var ackPanel = document.getElementById('closed-status-acknowledge');
        var ackCheckbox = document.getElementById('acknowledge_closed_status');
        var action = toIntOrNull(getRadioValue('action'));
        var ps = toIntOrNull(getRadioValue('process_status'));
        var consultStatus = toIntOrNull(getRadioValue('consult_status'));
        // Only show warning for the deliberate Refer Internal + Closed combination.
        // No Show and Cancelled forcing Closed is expected backend behaviour and does not need acknowledgment.
        var show = (ps === 3 && action === 1 && consultStatus !== 2 && consultStatus !== 3);
        var ackError = document.getElementById('ack-checkbox-error');
        if (warning) warning.style.display = show ? '' : 'none';
        if (ackPanel) ackPanel.style.display = show ? 'block' : 'none';
        if (!show && ackCheckbox) ackCheckbox.checked = false;
        if (!show && ackError) ackError.style.display = 'none';
    }

    /**
     * Update process_status radio state based on the selected action value.
     * Refer External (2) and End Process (3) pre-select Closed (doctor can still change it).
     * Refer Internal (1) or no action defaults to Active if nothing is selected.
     * @param {string} value Action radio value as string
     */
    function handleActionChange(value) {
        // No Show always locks process_status to Closed regardless of action selected.
        // The backend enforces the same rule; overriding to Active here creates a UI/data mismatch.
        if (getRadioValue('consult_status') === CONSULT_NO_SHOW) {
            setProcessStatusRadio('3', true);
            checkEndProcessWarning();
            checkClosedProcessWarning();
            return;
        }
        if (value === '2' || value === '3') {
            setProcessStatusRadio('3', false);
        } else if (value === '1') {
            setProcessStatusRadio('1', false);
        } else {
            setProcessStatusRadio(null, false);
        }
        checkEndProcessWarning();
        checkClosedProcessWarning();
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
                // Use the current follow-up's scheduled date as the base when available,
                // so the next follow-up is calculated from that visit, not from today.
                var d = followUpBaseDateStr ? new Date(followUpBaseDateStr) : new Date();
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

    // Populates the "Recommended Add Ons" dropdown from the add_ons lookup table.
    // Non-fatal on failure -- the field just keeps its default "Select Add On" option.
    function loadAddOnsOptions() {
        var select = document.getElementById('add_on_id');
        if (!select) return Promise.resolve();
        return apiCall('get-add-ons', {}).then(function(result) {
            if (!result.success || !result.data) return;
            for (var i = 0; i < result.data.length; i++) {
                var opt = document.createElement('option');
                opt.value = result.data[i].id;
                opt.textContent = result.data[i].name;
                select.appendChild(opt);
            }
        }).catch(function() {});
    }

    // Consent status labels for the global-view read-only Eligibility summary,
    // mirroring the ConsultCall Eligibility radio options -- global view renders a
    // stripped-down readonly card instead of the interactive form, so the labels
    // can't be read off radio inputs like elsewhere.
    var CONSENT_STATUS_LABELS = {
        '0': 'Pending',
        '1': 'Obtained',
        '2': 'Refused',
        '3': 'Others'
    };

    // Consultation Type labels for the Consultation History accordion, mirroring the
    // Consultation Details radio options (1=New Case, 2=Follow-Up).
    var CONSULTATION_TYPE_LABELS = {
        '1': 'New Case',
        '2': 'Follow-Up'
    };

    // Populate the read-only Consent Status / Reason / Remarks fields shown to global view
    // (blood_test campaign link) in place of the full ConsultCall Eligibility form.
    function populateEligibilitySummary(data) {
        var consentStatus = (data.consent_call_status !== undefined && data.consent_call_status !== null)
            ? String(data.consent_call_status) : null;
        setText('elig-consent-status', consentStatus !== null ? (CONSENT_STATUS_LABELS[consentStatus] || '') : '');
        setText('elig-reason', data.reason || '');
        setText('elig-add-on', (data.add_on && data.add_on.name) || '');
        setText('elig-remarks', data.final_remarks || '');
    }

    function renderConsultationHistory(details, followUps) {
        var container = document.getElementById('consultation-history-container');
        if (!container) return;

        var staffMap = buildStaffMap();
        var modeConversionMap = buildRadioLabelMap('mode_of_conversion');
        var isGlobalView = !!EDIT_CONFIG.globalView;

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

            // Build accordion header: always use updated_at of the detail record
            var headerCreatedAt = d.updated_at ? formatDate(d.updated_at) : '';
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

            // Base info is always shown (blood test report, risk tier, clinical condition).
            // Global view (blood_test campaign link) only gets blood test report + risk tier.
            html += renderAccordionBaseInfo(d, isGlobalView);

            // Edit is only offered once the consultation is completed, and never in global view
            if (isCompleted && !isGlobalView) {
                html += '<div class="d-flex justify-content-end mb-2">';
                html += '<button type="button" class="btn btn-sm btn-outline-primary" id="history-edit-btn-' + p + '" onclick="editHistoryEntry(' + p + ')">';
                html += '<i class="bi bi-pencil me-1"></i>Edit</button>';
                html += '</div>';
            }

            html += '<div id="history-view-' + p + '">';

            // Consultation section: only render when at least one consultation field has data
            var hasConsultData = !!(d.consult_date || d.consulted_by || d.diagnosis || d.treatment_plan || d.remarks);
            if (hasConsultData) {
                html += '<hr class="my-2">';
                html += '<div class="mb-1"><strong>Consultation</strong></div>';
                html += '<div class="row g-2">';
                html += '<div class="col-3">' + renderHistoryField('Consult Date', d.consult_date ? formatDate(d.consult_date) : null) + '</div>';
                html += '<div class="col-3">' + renderHistoryField('Consulted By', staffMap[String(d.consulted_by)] || null) + '</div>';
                html += '<div class="col-3">' + renderHistoryField('Consult Status', statusMaps.consultStatuses[String(d.consult_status)] || null) + '</div>';
                html += '<div class="col-3">' + renderHistoryField('Consultation Type', CONSULTATION_TYPE_LABELS[String(d.consultation_type)] || null) + '</div>';
                html += '</div>';
                if (isCompleted && !isGlobalView) {
                    html += renderHistoryField('Documentation', d.documentation || null);
                    html += renderHistoryField('Diagnosis', d.diagnosis || null);
                    html += renderHistoryField('Treatment Plan', d.treatment_plan || null);
                    // Detail-level field (not tied to a follow-up record), so it stays
                    // available here even for completed detail with no paired follow-up
                    // (e.g. action = End Process never creates one).
                    html += renderHistoryField('Rx Issued', d.rx_issued ? 'Yes' : 'No');
                }
                html += renderHistoryField('Remarks', d.remarks || null);

                // Follow-up fields (2-column grid, matching the Consultation Details layout:
                // Follow Up Type | Next Follow Up, Next Follow Up Date | Mode of Conversion) --
                // not shown in global view. Blood Test Required removed to match Consultation
                // Details; Action stays full-width for its My Referral link/unlink controls.
                if (isCompleted && fu && !isGlobalView) {
                    html += '<hr class="my-2">';
                    html += '<div class="mb-1"><strong>Follow-up</strong></div>';
                    html += '<div class="row g-2">';

                    html += '<div class="col-6">' + renderHistoryField('Follow Up Type', statusMaps.followupTypes[String(fu.followup_type)] || null) + '</div>';
                    html += '<div class="col-6">' + renderHistoryField('Next Follow Up', statusMaps.nextFollowups[String(fu.next_followup)] || null) + '</div>';

                    html += '<div class="col-6">' + renderHistoryField('Next Follow Up Date', (fu.next_followup && String(fu.next_followup) !== '0') ? formatDate(fu.followup_date) : null) + '</div>';
                    html += '<div class="col-6">' + renderHistoryField('Mode of Conversion', modeConversionMap[String(fu.mode_of_conversion)] || null) + '</div>';

                    var actionLabel = statusMaps.actions[String(d.action)] || null;
                    var actionCell = '<div class="mb-2"><div class="history-label">Action</div>'
                        + '<div class="history-value">' + escapeHtml(actionLabel || '') + '</div>';
                    if (fu.my_referral_id) {
                        actionCell += '<div class="d-flex gap-1 mt-1">';
                        actionCell += '<a href="/odb/referral/view.php?id=' + encodeURIComponent(fu.my_referral_id) + '"'
                            + ' target="_blank" class="btn btn-sm btn-outline-primary">View MyReferral</a>';
                        actionCell += '<button type="button" class="btn btn-sm btn-outline-danger" onclick="unlinkMyReferral(' + fu.id + ')">Unlink</button>';
                        actionCell += '</div>';
                    }
                    actionCell += '</div>';
                    html += '<div class="col-12">' + actionCell + '</div>';

                    html += '</div>'; // row
                }
            }

            html += '</div>'; // history-view

            // Inline edit form: built once, hidden until the Edit button is clicked.
            // Never built for global view -- keeps edit affordances out of the DOM entirely.
            if (isCompleted && !isGlobalView) {
                html += '<div id="history-edit-' + p + '" data-detail-id="' + escapeHtml(d.id) + '"';
                html += ' data-follow-up-id="' + (fu && fu.id ? escapeHtml(fu.id) : '') + '" style="display:none;">';
                html += renderHistoryEditForm(p, d, fu);
                html += '</div>';
            }

            html += '</div>'; // accordion-body
            html += '</div>'; // accordion-collapse
            html += '</div>'; // accordion-item
        }

        html += '</div>'; // accordion
        container.innerHTML = html;
    }

    function renderAccordionBaseInfo(detail, isGlobalView) {
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

        // Clinical condition -- not shown in global view (blood_test campaign link)
        if (!isGlobalView) {
            html += renderHistoryField('Clinical Condition', cc ? (cc.description || null) : null);
            html += renderHistoryField('Add-Ons Type', cc ? (cc.type || null) : null);
        }

        html += '</div>';
        return html;
    }

    function renderHistoryField(label, value) {
        return '<div class="mb-2">'
            + '<div class="history-label">' + escapeHtml(label) + '</div>'
            + '<div class="history-value">' + escapeHtml(value || '') + '</div>'
            + '</div>';
    }

    // -- Consultation History inline edit --

    // Clone the main form's Consulted By options so the inline editor lists the same staff,
    // pre-selecting selectedValue (the entry's current consulted_by)
    function getConsultedByOptionsHtml(selectedValue) {
        var select = document.getElementById('consulted_by');
        if (!select) return '<option value="">Select Staff</option>';

        var html = '';
        for (var i = 0; i < select.options.length; i++) {
            var opt = select.options[i];
            var isSelected = (selectedValue !== null && selectedValue !== undefined && String(selectedValue) === opt.value);
            html += '<option value="' + escapeHtml(opt.value) + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(opt.text) + '</option>';
        }
        return html;
    }

    // Build a Bootstrap radio-group for a history edit form field, name-scoped by row index
    function historyRadioGroup(field, idx, options, selectedValue) {
        var html = '<div class="radio-group">';
        for (var i = 0; i < options.length; i++) {
            var id = 'hist_' + field + '_' + idx + '_' + options[i].value;
            var checked = (selectedValue !== null && selectedValue !== undefined && String(selectedValue) === String(options[i].value)) ? 'checked' : '';
            html += '<div class="form-check">';
            html += '<input class="form-check-input" type="radio" name="hist_' + field + '_' + idx + '" id="' + id + '" value="' + options[i].value + '" ' + checked + '>';
            html += '<label class="form-check-label" for="' + id + '">' + escapeHtml(options[i].label) + '</label>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function getHistInputValue(idx, field) {
        var el = document.getElementById('hist_' + field + '_' + idx);
        return el ? el.value : '';
    }

    function getHistRadioValue(idx, field) {
        var checked = document.querySelector('input[name="hist_' + field + '_' + idx + '"]:checked');
        return checked ? checked.value : '';
    }

    /**
     * Build the inline edit form for one Consultation History accordion entry.
     * Detail fields are always editable; follow-up fields only appear when a
     * follow-up record (fu) already exists for this entry.
     * @param {number} idx Row index, used to scope field ids/names
     * @param {object} d Consultation detail record
     * @param {object|null} fu Paired follow-up record, or null
     * @returns {string} HTML for the edit form
     */
    function renderHistoryEditForm(idx, d, fu) {
        var html = '<hr class="my-2">';
        html += '<div class="row g-3">';

        html += '<div class="col-md-4"><label class="form-label">Consult Date</label>'
            + '<input type="date" class="form-control form-control-sm" id="hist_consult_date_' + idx + '" value="' + escapeHtml(toDateValue(d.consult_date)) + '"></div>';

        html += '<div class="col-md-4"><label class="form-label">Consulted By</label>'
            + '<select class="form-select form-select-sm" id="hist_consulted_by_' + idx + '">' + getConsultedByOptionsHtml(d.consulted_by) + '</select></div>';

        html += '<div class="col-md-4"><label class="form-label">Consult Status</label>'
            + historyRadioGroup('consult_status', idx, [
                { value: '0', label: 'Pending' }, { value: '1', label: 'Completed' },
                { value: '2', label: 'No-show' }, { value: '3', label: 'Cancelled' }
            ], d.consult_status) + '</div>';

        html += '<div class="col-md-4"><label class="form-label">Consultation Type</label>'
            + historyRadioGroup('consultation_type', idx, [
                { value: '1', label: 'New Case' }, { value: '2', label: 'Follow-Up' }
            ], d.consultation_type) + '</div>';

        html += '<div class="col-md-12"><label class="form-label">Documentation</label>'
            + '<textarea class="form-control form-control-sm" id="hist_documentation_' + idx + '" rows="3">' + escapeHtml(d.documentation || '') + '</textarea></div>';

        html += '<div class="col-md-12"><label class="form-label">Diagnosis</label>'
            + '<textarea class="form-control form-control-sm" id="hist_diagnosis_' + idx + '" rows="4">' + escapeHtml(d.diagnosis || '') + '</textarea></div>';

        html += '<div class="col-md-12"><label class="form-label">Treatment Plan</label>'
            + '<textarea class="form-control form-control-sm" id="hist_treatment_plan_' + idx + '" rows="4">' + escapeHtml(d.treatment_plan || '') + '</textarea></div>';

        html += '<div class="col-md-6"><label class="form-label">Rx Issued</label>'
            + historyRadioGroup('rx_issued', idx, [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }], d.rx_issued ? '1' : '0') + '</div>';

        html += '<div class="col-md-6"><label class="form-label">Action</label>'
            + historyRadioGroup('action', idx, [
                { value: '1', label: 'Refer Internal' }, { value: '2', label: 'Refer External' }, { value: '3', label: 'End Process' }
            ], d.action) + '</div>';

        html += '<div class="col-md-12"><label class="form-label">Remarks</label>'
            + '<textarea class="form-control form-control-sm" id="hist_remarks_' + idx + '" rows="2">' + escapeHtml(d.remarks || '') + '</textarea></div>';

        if (fu) {
            html += '<div class="col-12"><hr class="my-2"><strong>Follow-up</strong></div>';

            html += '<div class="col-md-6"><label class="form-label">Follow Up Type</label>'
                + historyRadioGroup('followup_type', idx, [
                    { value: '0', label: 'No' }, { value: '1', label: 'Blood Test + Review' }, { value: '2', label: 'Review Only' }
                ], fu.followup_type) + '</div>';

            html += '<div class="col-md-6"><label class="form-label">Next Follow Up</label>'
                + historyRadioGroup('next_followup', idx, [
                    { value: '0', label: 'None' }, { value: '1', label: '1 Month' }, { value: '2', label: '3 Months' }, { value: '3', label: '6 Months' }
                ], fu.next_followup) + '</div>';

            html += '<div class="col-md-6"><label class="form-label">Next Follow Up Date</label>'
                + '<input type="date" class="form-control form-control-sm" id="hist_followup_date_' + idx + '" value="' + escapeHtml(toDateValue(fu.followup_date)) + '"></div>';

            html += '<div class="col-md-6"><label class="form-label">Mode of Conversion</label>'
                + historyRadioGroup('mode_of_conversion', idx, [
                    { value: '0', label: 'None' }, { value: '1', label: 'Outlet' }, { value: '2', label: 'Clinic' }
                ], fu.mode_of_conversion) + '</div>';
        }

        html += '</div>'; // row

        html += '<div class="d-flex justify-content-end align-items-center gap-2 mt-3">';
        html += '<div class="text-danger small me-auto" id="hist_error_' + idx + '" style="display:none;"></div>';
        html += '<button type="button" class="btn btn-sm btn-outline-secondary" onclick="cancelHistoryEdit(' + idx + ')">Cancel</button>';
        html += '<button type="button" class="btn btn-sm btn-primary" id="history-save-btn-' + idx + '" onclick="saveHistoryEdit(' + idx + ')">Save</button>';
        html += '</div>';

        return html;
    }

    window.editHistoryEntry = function(idx) {
        var viewEl = document.getElementById('history-view-' + idx);
        var editEl = document.getElementById('history-edit-' + idx);
        var btn = document.getElementById('history-edit-btn-' + idx);
        if (viewEl) viewEl.style.display = 'none';
        if (editEl) editEl.style.display = '';
        if (btn) btn.style.display = 'none';
    };

    window.cancelHistoryEdit = function(idx) {
        var viewEl = document.getElementById('history-view-' + idx);
        var editEl = document.getElementById('history-edit-' + idx);
        var btn = document.getElementById('history-edit-btn-' + idx);
        if (viewEl) viewEl.style.display = '';
        if (editEl) editEl.style.display = 'none';
        if (btn) btn.style.display = '';
    };

    window.saveHistoryEdit = function(idx) {
        var editContainer = document.getElementById('history-edit-' + idx);
        if (!editContainer) return;

        var detailId = editContainer.getAttribute('data-detail-id');
        var followUpId = editContainer.getAttribute('data-follow-up-id');

        var errorEl = document.getElementById('hist_error_' + idx);
        if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

        var detailData = {
            consult_date: getHistInputValue(idx, 'consult_date') || null,
            consulted_by: toIntOrNull(getHistInputValue(idx, 'consulted_by')),
            consult_status: toIntOrNull(getHistRadioValue(idx, 'consult_status')),
            consultation_type: toIntOrNull(getHistRadioValue(idx, 'consultation_type')),
            documentation: getHistInputValue(idx, 'documentation') || null,
            diagnosis: getHistInputValue(idx, 'diagnosis') || null,
            treatment_plan: getHistInputValue(idx, 'treatment_plan') || null,
            rx_issued: getHistRadioValue(idx, 'rx_issued') === '1',
            action: toIntOrNull(getHistRadioValue(idx, 'action')),
            remarks: getHistInputValue(idx, 'remarks') || null
        };

        var promises = [apiCall('update-detail', {
            consult_call_id: EDIT_CONFIG.consultCallId,
            detail_id: detailId,
            data: detailData
        })];

        if (followUpId) {
            var followUpData = {
                followup_type: toIntOrNull(getHistRadioValue(idx, 'followup_type')),
                next_followup: toIntOrNull(getHistRadioValue(idx, 'next_followup')),
                followup_date: getHistInputValue(idx, 'followup_date') || null,
                mode_of_conversion: toIntOrNull(getHistRadioValue(idx, 'mode_of_conversion'))
            };
            promises.push(apiCall('update-follow-up', {
                consult_call_id: EDIT_CONFIG.consultCallId,
                follow_up_id: followUpId,
                data: followUpData
            }));
        }

        var saveBtn = document.getElementById('history-save-btn-' + idx);
        var originalText = saveBtn ? saveBtn.innerHTML : '';
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>Saving...';
        }

        Promise.all(promises).then(function(results) {
            for (var i = 0; i < results.length; i++) {
                if (!results[i].success) {
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalText; }
                    if (errorEl) { errorEl.textContent = results[i].message || 'Failed to save changes.'; errorEl.style.display = ''; }
                    return;
                }
            }
            // Reload the full record so the accordion reflects the saved changes
            loadConsultCallData();
        }).catch(function(err) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = originalText; }
            if (errorEl) { errorEl.textContent = 'Error saving changes.'; errorEl.style.display = ''; }
            console.error('Failed to save history edit:', err);
        });
    };

    // Clear the linked MyReferral record from a follow-up (sets my_referral_id back to null)
    window.unlinkMyReferral = function(followUpId) {
        var confirmed = window.confirm('Unlink this MyReferral record? This does not delete the referral itself, only removes the link here.');
        if (!confirmed) return;

        apiCall('update-follow-up', {
            consult_call_id: EDIT_CONFIG.consultCallId,
            follow_up_id: followUpId,
            data: { my_referral_id: null }
        }).then(function(result) {
            if (!result.success) {
                alert('Failed to unlink MyReferral: ' + (result.message || 'Unknown error'));
                return;
            }
            loadConsultCallData();
        }).catch(function(err) {
            alert('Error unlinking MyReferral.');
            console.error('Failed to unlink MyReferral:', err);
        });
    };

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

    function disableConsultationSection() {
        var section = document.getElementById('section-consultation');
        if (!section) return;
        var fields = section.querySelectorAll('input, select, textarea');
        for (var i = 0; i < fields.length; i++) {
            fields[i].disabled = true;
        }
    }

    function collapseConsultationSection() {
        var header = document.querySelector('.section-header[data-section="consultation"]');
        var content = document.getElementById('section-consultation');
        if (header) { header.classList.add('collapsed'); }
        if (content) { content.classList.add('collapsed'); }
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

        var reasonSelect = document.querySelector('select[name="reason"]');
        if (reasonSelect) {
            reasonSelect.addEventListener('change', function() {
                handleReasonChange(this.value);
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
                var newValue = this.value;
                if (newValue === CONSULT_COMPLETED && !isDetailClaimedByCurrentDoctor) {
                    var confirmed = window.confirm(
                        'Assign this consultation to yourself?\n\n' +
                        'Once confirmed, other doctors will not be able to edit this record.'
                    );
                    if (!confirmed) {
                        if (prevConsultStatus) {
                            setRadioValue('consult_status', prevConsultStatus);
                        } else {
                            var allConsultRadios = document.querySelectorAll('input[name="consult_status"]');
                            for (var ci = 0; ci < allConsultRadios.length; ci++) {
                                allConsultRadios[ci].checked = false;
                            }
                        }
                        handleConsultStatusChange(prevConsultStatus);
                        return;
                    }
                }
                prevConsultStatus = newValue;
                handleConsultStatusChange(newValue);
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

        var processStatusRadios = document.querySelectorAll('input[name="process_status"]');
        for (var ps = 0; ps < processStatusRadios.length; ps++) {
            processStatusRadios[ps].addEventListener('change', function() {
                checkEndProcessWarning();
                checkClosedProcessWarning();
            });
        }

        var ackCheckboxEl = document.getElementById('acknowledge_closed_status');
        if (ackCheckboxEl) {
            ackCheckboxEl.addEventListener('change', function() {
                if (this.checked) {
                    var ackErr = document.getElementById('ack-checkbox-error');
                    if (ackErr) ackErr.style.display = 'none';
                }
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

        // Global view's read-only Eligibility card (Consent Status + Remarks only);
        // no-op elsewhere since #elig-consent-status/#elig-remarks aren't in the DOM.
        populateEligibilitySummary(data);

        // -- Consult Call level fields (integer IDs) --

        // Consent status (0=Pending, 1=Obtained, 2=Refused, 3=Others)
        var consentStatus = (data.consent_call_status !== undefined && data.consent_call_status !== null)
            ? String(data.consent_call_status) : CONSENT_PENDING;
        setRadioValue('consent_status', consentStatus);
        // Populate the Reason field first -- handleConsentChange() runs last so its
        // Refused/Others visibility check has final say over whether the Reason
        // field and Remarks required-mark are actually shown.
        populateReasonField(data.reason || null);
        setSelectValue('add_on_id', data.add_on_id || '');
        handleConsentChange(consentStatus);

        // Also show consultation section when the latest detail is past Pending (doctor has acted),
        // so the section remains visible after consent is set to Refused on cancellation.
        // Use data.details directly — the local `details` variable is not declared until later.
        var rawDetails = data.details || [];
        var latestDetailForSection = rawDetails.length > 0 ? rawDetails[rawDetails.length - 1] : null;
        var detailHasAction = !!(latestDetailForSection && String(latestDetailForSection.consult_status) !== '0');
        toggleConsultationSection(String(data.consent_call_status) === CONSENT_OBTAINED || detailHasAction);

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
            originalHandledBy = data.handled_by;
        }
        // Auto-select current staff for Handled By if no saved value and user is HQ (role 4)
        if (!data.handled_by && EDIT_CONFIG.currentStaffRole === 4 && EDIT_CONFIG.currentStaffId) {
            setSelectValue('handled_by', String(EDIT_CONFIG.currentStaffId));
        }
        // Consent refused fields
        if (data.final_remarks) {
            setInputValue('refusal_remarks', data.final_remarks);
        }

        // -- Detail and follow-up IDs (for update-vs-create logic on submit) --
        // Form fields are intentionally left blank; submitted data is read-only in history.
        var details = data.details || [];
        var followUps = data.follow_ups || [];
        currentDetailId = null;
        doctorFollowUpId = null;
        currentFollowUpId = null;
        isDetailClaimedByCurrentDoctor = false;

        // Header Process Status pill toggle always tracks the latest detail record,
        // independent of the update-vs-create branching below.
        if (details.length > 0) {
            var latestDetailForHeader = details[details.length - 1];
            showHeaderProcessStatus(latestDetailForHeader.id, latestDetailForHeader.process_status);
        } else {
            hideHeaderProcessStatus();
        }

        // Reset all consultation detail fields so that a soft refresh via loadConsultCallData()
        // leaves the form in the same blank state as a full page reload would. Without this,
        // fields filled in by the doctor remain visible after the save completes.
        // Defaults to today; overwritten below when re-editing a historical consult_date.
        setInputValue('consult_date', toDateValue(new Date()));
        setSelectValue('consulted_by', '');
        setInputValue('documentation', '');
        setInputValue('diagnosis', '');
        setInputValue('treatment_plan', '');
        setInputValue('followup_date', '');
        setInputValue('remarks', '');
        setRadioValue('followup_type', '0');
        setRadioValue('next_followup', '0');
        var detailFieldsToDeselect = ['consult_status', 'rx_issued', 'mode_of_conversion', 'action', 'process_status', 'consultation_type'];
        for (var dfi = 0; dfi < detailFieldsToDeselect.length; dfi++) {
            var dfRads = document.querySelectorAll('input[name="' + detailFieldsToDeselect[dfi] + '"]');
            for (var dfj = 0; dfj < dfRads.length; dfj++) { dfRads[dfj].checked = false; }
        }
        // Consult Status defaults to Pending (mirrors Consent Status's default) unless a
        // branch below overrides it based on the doctor's own in-progress/completed record.
        setRadioValue('consult_status', CONSULT_PENDING);
        handleConsultStatusChange('');
        handleNextFollowUpChange('0', false);
        handleActionChange('');
        prevConsultStatus = CONSULT_PENDING;

        // HQ checkpoint always targets the latest follow-up record
        if (followUps.length > 0) {
            currentFollowUpId = followUps[followUps.length - 1].id || null;
        }

        // Doctor update-vs-create: only track IDs when the latest detail is not yet
        // completed. A completed detail means the doctor is starting a new consultation
        // and new records must be created rather than the previous ones overwritten.
        previousDetailClinicalConditionId = null;
        previousDetailTestResultId = null;
        if (details.length > 0) {
            var lastDetail = details[details.length - 1];
            // Always carry forward clinical_condition_id and test_result_id from the
            // most recent detail so they can be re-used when creating the next one.
            // TODO [DEPLOY]: remove this carry-forward once the UI collects these values.
            previousDetailClinicalConditionId = lastDetail.clinical_condition_id || null;
            previousDetailTestResultId = lastDetail.test_result_id || null;
            var lastIsCompleted = String(lastDetail.consult_status) === '1';
            var lastIsByCurrentDoctor = !!(lastDetail.consulted_by &&
                parseInt(EDIT_CONFIG.currentStaffId, 10) === lastDetail.consulted_by);
            var pairedFollowUp = followUps[details.length - 1] || null;
            // When HQ has marked the follow-up checkpoint as completed (followup_reminder = 1),
            // the previous consultation cycle is closed. The doctor must start a fresh record.
            var followUpCheckpointDone = pairedFollowUp && String(pairedFollowUp.followup_reminder) === '1';
            // A rescheduled follow-up (reminder = 2) opens a new consultation cycle just like
            // a completed checkpoint. Force CREATE mode so the doctor's save produces a new
            // detail and follow-up record rather than overwriting the previous completed ones.
            var pairedFollowUpIsRescheduled = pairedFollowUp && String(pairedFollowUp.followup_reminder) === '2';
            // Track ID for update when: detail is pending, OR detail is completed by this doctor.
            // Completed-by-same-doctor keeps UPDATE mode so a re-save edits the record rather
            // than creating a duplicate. Only a pending record from a new re-enrollment cycle
            // (created by the eligibility service) should enter CREATE mode.
            // When followUpCheckpointDone or pairedFollowUpIsRescheduled, always enter CREATE mode.
            if ((!lastIsCompleted || lastIsByCurrentDoctor) && !followUpCheckpointDone && !pairedFollowUpIsRescheduled) {
                currentDetailId = lastDetail.id || null;
                if (pairedFollowUp) {
                    doctorFollowUpId = pairedFollowUp.id || null;
                }
            }
            // Doctor has already claimed this detail (consulted_by = current staff) but has
            // not yet saved consult_status as completed. Show Pending radio pre-selected and
            // flag the claim so the confirmation dialog is skipped when they click Completed.
            if (lastIsByCurrentDoctor && !lastIsCompleted && !followUpCheckpointDone) {
                isDetailClaimedByCurrentDoctor = true;
                setRadioValue('consult_status', CONSULT_PENDING);
                prevConsultStatus = CONSULT_PENDING;
            }
            // Pre-populate consultation form fields when the same doctor re-opens their
            // completed record so that a subsequent save goes to UPDATE, not CREATE.
            // Only pre-populate when there is no paired follow-up yet (i.e., the detail was
            // saved without a follow-up, such as EndProcess). Once a follow-up exists the
            // UPDATE mode guard on currentDetailId is enough to prevent duplicates, and
            // pre-populating would leave stale form data visible after the save completes.
            // Exception: drafts (is_draft === 1) may have a paired draft follow-up — allow
            // pre-population so the doctor sees their saved progress after a draft reload.
            // Skip pre-population when the follow-up checkpoint is done (new cycle expected).
            var isDraftDetail = lastDetail.is_draft === 1;
            if (lastIsCompleted && lastIsByCurrentDoctor && !followUpCheckpointDone && (!pairedFollowUp || isDraftDetail)) {
                setInputValue('consult_date', toDateValue(lastDetail.consult_date));
                setSelectValue('consulted_by', String(lastDetail.consulted_by));
                var completedStatus = String(lastDetail.consult_status);
                setRadioValue('consult_status', completedStatus);
                prevConsultStatus = completedStatus;
                handleConsultStatusChange(completedStatus);
                setInputValue('documentation', lastDetail.documentation || '');
                setInputValue('diagnosis', lastDetail.diagnosis || '');
                setInputValue('treatment_plan', lastDetail.treatment_plan || '');
                setRadioValue('rx_issued', lastDetail.rx_issued ? '1' : '0');
                if (lastDetail.consultation_type) {
                    setRadioValue('consultation_type', String(lastDetail.consultation_type));
                }
                if (lastDetail.action) {
                    setRadioValue('action', String(lastDetail.action));
                    handleActionChange(String(lastDetail.action));
                }
                // Set process_status from saved data, preserving the doctor's explicit choice
                // for Refer Internal. handleActionChange already locked the radio for action 2/3.
                if (lastDetail.process_status !== undefined && lastDetail.process_status !== null) {
                    setProcessStatusRadio(String(lastDetail.process_status), false);
                }
                setInputValue('remarks', lastDetail.remarks || '');
                if (pairedFollowUp) {
                    var fuType = pairedFollowUp.followup_type !== null ? String(pairedFollowUp.followup_type) : '0';
                    setRadioValue('followup_type', fuType);
                    var nextFu = pairedFollowUp.next_followup !== null ? String(pairedFollowUp.next_followup) : '0';
                    setRadioValue('next_followup', nextFu);
                    handleNextFollowUpChange(nextFu, false);
                    if (pairedFollowUp.followup_date) {
                        setInputValue('followup_date', toDateValue(pairedFollowUp.followup_date));
                    }
                    if (pairedFollowUp.mode_of_conversion !== null && pairedFollowUp.mode_of_conversion !== undefined) {
                        setRadioValue('mode_of_conversion', String(pairedFollowUp.mode_of_conversion));
                    }
                }
            }
        }

        // When the doctor is resuming a consultation that already has a paired non-draft
        // follow-up (doctorFollowUpId set, checkpoint not done), re-populate the follow-up
        // fields from the saved record. Without this, the reset block clears all follow-up
        // fields to defaults on every page reload, causing a silent overwrite of previously
        // saved values when the doctor saves again without re-selecting them.
        if (doctorFollowUpId && pairedFollowUp) {
            var fuRepopType = pairedFollowUp.followup_type !== null ? String(pairedFollowUp.followup_type) : '0';
            setRadioValue('followup_type', fuRepopType);
            var fuRepopNext = pairedFollowUp.next_followup !== null ? String(pairedFollowUp.next_followup) : '0';
            setRadioValue('next_followup', fuRepopNext);
            handleNextFollowUpChange(fuRepopNext, false);
            if (pairedFollowUp.followup_date) {
                setInputValue('followup_date', toDateValue(pairedFollowUp.followup_date));
            }
            if (pairedFollowUp.mode_of_conversion !== null && pairedFollowUp.mode_of_conversion !== undefined) {
                setRadioValue('mode_of_conversion', String(pairedFollowUp.mode_of_conversion));
            }
        }

        // Re-apply No Show or Cancelled after the reset block cleared the detail radios.
        // The reset block unselects all detail radios; terminal statuses must be restored here
        // since they are never populated by the doctor-specific pre-population path above.
        if (details.length > 0) {
            var lastDetailStatus = String(details[details.length - 1].consult_status);
            if (lastDetailStatus === CONSULT_NO_SHOW || lastDetailStatus === CONSULT_CANCELLED) {
                setRadioValue('consult_status', lastDetailStatus);
                prevConsultStatus = lastDetailStatus;
                handleConsultStatusChange(lastDetailStatus);
            }
        }

        // Auto-select current staff as Consulted By for Doctor role (role 2)
        if (EDIT_CONFIG.currentStaffRole === 2 && EDIT_CONFIG.currentStaffId) {
            setSelectValue('consulted_by', String(EDIT_CONFIG.currentStaffId));
        }

        // Show Follow-up Checkpoint section only when the latest follow-up has a type that is not None (0)
        var latestFollowUp = followUps.length > 0 ? followUps[followUps.length - 1] : null;
        var hasActiveFollowUp = latestFollowUp && String(latestFollowUp.followup_type) !== '0';

        // When a new consultation is being entered (latest detail completed), use the
        // current follow-up's scheduled date as the base for next-follow-up auto-population.
        followUpBaseDateStr = null;
        if (!currentDetailId && latestFollowUp && latestFollowUp.followup_date) {
            followUpBaseDateStr = toDateValue(latestFollowUp.followup_date);
        }

        toggleFollowUpCheckpointSection(!!hasActiveFollowUp);

        // Lock eligibility section once the consultation has been completed (not a draft)
        var latestDetail = details.length > 0 ? details[details.length - 1] : null;
        var detailIsDraft = !!(latestDetail && latestDetail.is_draft === 1);

        // Hide Save as Draft once the doctor has submitted (is_draft = 2)
        if (latestDetail && latestDetail.is_draft === 2) {
            var draftBtnEl = document.getElementById('draftBtn');
            if (draftBtnEl) {
                draftBtnEl.style.display = 'none';
            }
        }

        if (!detailIsDraft && latestDetail && String(latestDetail.consult_status) === '1') {
            disableEligibilitySection();
        }

        // Lock consultation section when completed (not a draft) or owned by a different doctor.
        // Drafts bypass the completion lock but still respect the doctor ownership lock so
        // only the doctor who saved the draft can continue editing it.
        // A rescheduled follow-up (reminder = 2) also bypasses the lock — the patient is
        // returning for a new appointment and the doctor must enter fresh consultation details.
        var followUpCheckpointDone = latestFollowUp && String(latestFollowUp.followup_reminder) === '1';
        var followUpIsRescheduled = latestFollowUp && String(latestFollowUp.followup_reminder) === '2';
        var terminalConsultStatus = !detailIsDraft && latestDetail && (
            String(latestDetail.consult_status) === '1' ||
            String(latestDetail.consult_status) === CONSULT_CANCELLED
        );
        var ownedByOtherDoctor = latestDetail && latestDetail.consulted_by &&
            parseInt(EDIT_CONFIG.currentStaffId, 10) !== latestDetail.consulted_by;
        if (!followUpCheckpointDone && !followUpIsRescheduled && (terminalConsultStatus || ownedByOtherDoctor)) {
            disableConsultationSection();
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

        // Show MyReferral section when the latest saved detail requires a referral and none exists yet
        var myReferralSection = document.getElementById('myreferral-section');
        if (myReferralSection) {
            var actionRequiresReferral = latestDetail && (latestDetail.action === 1 || latestDetail.action === 2);
            var referralNotYetCreated = !latestFollowUp || !latestFollowUp.my_referral_id;
            var showMyReferral = !!(actionRequiresReferral && referralNotYetCreated);
            myReferralSection.style.display = showMyReferral ? '' : 'none';
            if (showMyReferral && sessionStorage.getItem('scrollToMyReferral')) {
                sessionStorage.removeItem('scrollToMyReferral');
                setTimeout(function() {
                    myReferralSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
            }
        }

        // Render read-only consultation history accordion
        renderConsultationHistory(data.details || [], data.follow_ups || []);

        // Apply view-only mode
        if (EDIT_CONFIG.viewOnly) {
            disableAllFormFields();
        }

        checkClosedProcessWarning();
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

        var draftBtn = document.getElementById('draftBtn');
        if (draftBtn) {
            draftBtn.style.display = 'none';
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
     * Run the full save flow: validates, then saves consult call, detail, and follow-up.
     * onSuccess is called with the saved follow-up ID (int or null) after all API calls succeed.
     * onFailure is called (no args) after an error alert when any API call fails.
     * @param {function} onSuccess Called with followUpId on success
     * @param {function} [onFailure] Called with no args on failure or validation error
     */
    function runSaveFlow(onSuccess, onFailure, options) {
        if (EDIT_CONFIG.viewOnly) {
            if (onFailure) onFailure();
            return;
        }

        var isDraft = !!(options && options.isDraft);

        clearAllErrors();
        if (!validateForm()) {
            if (onFailure) onFailure();
            return;
        }

        // Block save if End Process is selected with Active process status
        var warnAction = toIntOrNull(getRadioValue('action'));
        var warnProcessStatus = toIntOrNull(getRadioValue('process_status'));
        if (warnAction === 3 && warnProcessStatus === 1) {
            var confirmed = window.confirm(
                'Action is set to End Process but Process Status is still Active.\n\n' +
                'Are you sure you want to save with this combination?'
            );
            if (!confirmed) {
                if (onFailure) onFailure();
                return;
            }
        }

        // Block save if Process Status is Closed with Refer Internal action specifically.
        // Requires the acknowledgment checkbox AND a non-empty Remarks field before proceeding.
        // Draft saves bypass this check — only final Submit Changes is gated.
        // No Show (consult_status 2) forces Closed by backend design — no acknowledgment needed.
        var blockAction = toIntOrNull(getRadioValue('action'));
        var blockProcessStatus = toIntOrNull(getRadioValue('process_status'));
        var blockConsultStatus = toIntOrNull(getRadioValue('consult_status'));
        if (!isDraft && blockProcessStatus === 3 && blockAction === 1 && blockConsultStatus !== 2 && blockConsultStatus !== 3) {
            var ackCheckbox = document.getElementById('acknowledge_closed_status');
            var ackError = document.getElementById('ack-checkbox-error');
            var remarksVal = getInputValue('remarks').trim();
            var hasError = !ackCheckbox || !ackCheckbox.checked || !remarksVal;
            if (hasError) {
                if (ackCheckbox && !ackCheckbox.checked && ackError) {
                    ackError.style.display = '';
                }
                if (!remarksVal) {
                    showFieldError('remarks', 'Remarks are required when Process Status is Closed with Refer Internal action.');
                }
                var scrollTarget = document.getElementById('closed-no-end-process-warning');
                if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (onFailure) onFailure();
                return;
            }
        }

        var activeBtnId = (options && options.btnId) ? options.btnId : 'saveBtn';
        var activeBtn = document.getElementById(activeBtnId);
        var originalText = activeBtn ? activeBtn.innerHTML : '';
        if (activeBtn) {
            activeBtn.disabled = true;
            activeBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span>' +
                (isDraft ? 'Saving draft...' : 'Saving...');
        }

        // Consult call level data (matches API 2.5 Update fields)
        var consultCallData = {
            consent_call_status: toIntOrNull(getRadioValue('consent_status')),
            reason: getReasonValue(),
            add_on_id: toIntOrNull(getSelectValue('add_on_id')),
            consent_call_date: getInputValue('consent_call_date') || null,
            scheduled_status: toIntOrNull(getRadioValue('scheduled_status')),
            scheduled_call_date: getInputValue('scheduled_call_date') || null,
            updated_scheduled_date: getInputValue('updated_scheduled_date') || null,
            handled_by: toIntOrNull(getSelectValue('handled_by')) || originalHandledBy || null,
            final_remarks: getInputValue('refusal_remarks') || null
        };

        // Detail level data (matches API 3.1 Create Detail fields)
        // When consult_status is completed (1) and no existing detail record exists yet,
        // inject currentStaffId as consulted_by without relying on the select field.
        var consultStatusForDetail = toIntOrNull(getRadioValue('consult_status'));
        var consultedByValue = toIntOrNull(getSelectValue('consulted_by'));
        if (consultStatusForDetail === 1 && !currentDetailId && EDIT_CONFIG.currentStaffId) {
            consultedByValue = parseInt(EDIT_CONFIG.currentStaffId, 10);
        }
        var actionValue = toIntOrNull(getRadioValue('action'));
        var detailData = {
            // TODO [DEPLOY]: clinical_condition_id and test_result_id carried forward from the
            // most recent detail record (create or update) until the UI collects these values.
            clinical_condition_id: previousDetailClinicalConditionId,
            test_result_id: previousDetailTestResultId,
            consult_date: getInputValue('consult_date') || null,
            consulted_by: consultedByValue,
            consultation_type: toIntOrNull(getRadioValue('consultation_type')),
            consult_status: consultStatusForDetail,
            documentation: getInputValue('documentation') || null,
            diagnosis: getInputValue('diagnosis') || null,
            treatment_plan: getInputValue('treatment_plan') || null,
            rx_issued: getRadioValue('rx_issued') === '1',
            action: actionValue,
            // process_status is no longer part of this form -- it's managed independently
            // via the header pill toggle's own update-detail call. Sending null here would
            // overwrite the existing value and violate the column's NOT NULL constraint.
            remarks: getInputValue('remarks') || null
        };

        detailData.is_draft = isDraft ? 1 : 2;

        // Follow-up level data (matches API 4.1 Create Follow-Up fields)
        var followUpData = {
            followup_type: toIntOrNull(getRadioValue('followup_type')),
            next_followup: toIntOrNull(getRadioValue('next_followup')),
            followup_date: getInputValue('followup_date') || null,
            // Blood Test Required field was removed from the form; the DB column stays
            // nullable so historical/API data is unaffected, this just stops sending it.
            is_blood_test_required: null,
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

        // Closure variables set inside the first .then() and read in the second
        var followUpPromiseIndex = -1;
        var isFollowUpCreate = false;

        consultCallPromise.then(function(result) {
            if (!result.success) {
                if (activeBtn) { activeBtn.disabled = false; activeBtn.innerHTML = originalText; }
                alert('Failed to save consult call: ' + (result.message || 'Unknown error'));
                if (onFailure) onFailure();
                // Throw to skip the next .then() so success path is not reached
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

            // HQ (role 4): automatically update the detail when consent is refused/others
            // or when the scheduled appointment is cancelled.
            if (EDIT_CONFIG.currentStaffRole === 4) {
                var hqDetailData = null;
                if (consultCallData.consent_call_status === 2 || consultCallData.consent_call_status === 3) {
                    hqDetailData = hqDetailData || {};
                    hqDetailData.process_status = 3;
                }
                if (consultCallData.scheduled_status === 3) {
                    hqDetailData = hqDetailData || {};
                    hqDetailData.consult_status = 3;
                    // process_status will be forced to Closed by the backend's statusForcesClose rule
                }
                if (hqDetailData) {
                    if (currentDetailId) {
                        promises.push(apiCall('update-detail', {
                            consult_call_id: EDIT_CONFIG.consultCallId,
                            detail_id: currentDetailId,
                            data: hqDetailData
                        }));
                    } else {
                        promises.push(apiCall('create-detail', {
                            consult_call_id: EDIT_CONFIG.consultCallId,
                            data: hqDetailData
                        }));
                    }
                }
            }

            if (EDIT_CONFIG.currentStaffRole === 2) {
                var hasDetail = detailData.consult_date || detailData.diagnosis ||
                    detailData.treatment_plan || detailData.consult_status !== null;

                // Follow-up is only created when consultation is completed (status 1),
                // action is Refer Internal (1), process_status is Active (1), and follow-up data is present.
                // All other action/process_status combinations must not produce a follow-up record.
                // Exception: draft saves may create/update a follow-up to persist mode of conversion,
                // a follow-up field not present on the detail record.
                var draftHasFollowUpData = isDraft && getRadioValue('mode_of_conversion') !== '';
                var hasFollowUp = draftHasFollowUpData || (!isDraft &&
                    detailData.consult_status === 1 &&
                    actionValue === 1 &&
                    detailData.process_status === 1 && (
                        followUpData.followup_type !== null ||
                        followUpData.next_followup !== null ||
                        followUpData.followup_date
                    )
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
                    followUpPromiseIndex = promises.length;
                    isFollowUpCreate = !doctorFollowUpId;
                    if (doctorFollowUpId) {
                        promises.push(apiCall('update-follow-up', {
                            consult_call_id: EDIT_CONFIG.consultCallId,
                            follow_up_id: doctorFollowUpId,
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
                    if (activeBtn) { activeBtn.disabled = false; activeBtn.innerHTML = originalText; }
                    alert('Failed to save: ' + (results[i].message || 'Unknown error'));
                    if (onFailure) onFailure();
                    return;
                }
            }

            // Extract the follow-up ID from the create response, or use existing ID for updates
            var followUpId = null;
            if (followUpPromiseIndex >= 0 && results[followUpPromiseIndex]) {
                if (isFollowUpCreate) {
                    followUpId = (results[followUpPromiseIndex].data && results[followUpPromiseIndex].data.id)
                        ? results[followUpPromiseIndex].data.id
                        : null;
                } else {
                    followUpId = doctorFollowUpId;
                }
            }

            if (activeBtn) { activeBtn.disabled = false; activeBtn.innerHTML = originalText; }
            if (onSuccess) onSuccess(followUpId);
        }).catch(function(err) {
            // '__handled__' errors have already shown an alert; skip re-alerting
            if (err && err.message === '__handled__') {
                return;
            }
            if (activeBtn) { activeBtn.disabled = false; activeBtn.innerHTML = originalText; }
            alert('Error saving changes. Please try again.');
            if (onFailure) onFailure();
            console.error('Save error:', err);
        });
    }

    /**
     * Initialize form submission handler.
     * Delegates to runSaveFlow; shows success alert and reloads on completion.
     */
    function initFormSubmission() {
        var form = document.getElementById('editPatientForm');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            runSaveFlow(function() {
                alert('Changes saved successfully.');
                sessionStorage.setItem('scrollToMyReferral', '1');
                window.location.reload();
            });
        });

        var draftBtn = document.getElementById('draftBtn');
        if (draftBtn) {
            draftBtn.addEventListener('click', function() {
                runSaveFlow(function() {
                    alert('Saved as draft. You can continue editing.');
                    window.location.reload();
                }, null, { isDraft: true, btnId: 'draftBtn' });
            });
        }
    }

    // -- Initialization --

    document.addEventListener('DOMContentLoaded', function() {
        initSectionCollapse();
        initConditionalFields();
        initFormSubmission();
        initHeaderProcessStatus();
        Promise.all([loadStatusMaps(), loadAddOnsOptions()]).then(function() {
            loadConsultCallData();
        });
    });
})();
