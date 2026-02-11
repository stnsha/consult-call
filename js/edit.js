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
 *     is_blood_test_required (bool), mode_of_conversion, referral_to,
 *     my_referral_status (0-3), followup_reminder (0-3), rescheduled_date, remarks
 */
(function() {
    'use strict';

    // Consent status integer constants
    var CONSENT_PENDING = '0';
    var CONSENT_OBTAINED = '1';
    var CONSENT_REFUSED = '2';

    // Scheduled status integer constants
    var SCHEDULED_RESCHEDULE = '2';

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
        if (!dateStr) return '--';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = (value !== undefined && value !== null && value !== '') ? value : '--';
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

        // Default: consent pending (0)
        handleConsentChange(CONSENT_PENDING);
    }

    window.openPdfReport = function() {
        var pdfUrl = 'consultcall/reports/sample_blood_test.pdf';
        document.getElementById('pdfViewer').src = pdfUrl;
        var pdfModal = new bootstrap.Modal(document.getElementById('pdfModal'));
        pdfModal.show();
    };

    // -- Risk tier badge helper --

    function getRiskTierBadgeClass(tier) {
        if (tier === 'low') return 'bg-success';
        if (tier === 'moderate') return 'bg-warning';
        if (tier === 'high') return 'bg-danger';
        return 'bg-secondary';
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

        // Customer details (from ODB customer table)
        customer = customer || {};
        setText('patient-name', customer.name);
        setText('patient-icno', customer.ic);
        setText('patient-phone', customer.phone);
        setText('patient-email', customer.email);
        setText('patient-address', customer.address);
        setText('patient-age', customer.age);
        setText('patient-gender', customer.gender);

        // Risk tier with badge
        var riskTier = data.risk_tier || '';
        if (riskTier) {
            var badgeClass = getRiskTierBadgeClass(riskTier);
            setHtml('patient-risk-tier', '<span class="badge ' + badgeClass + '">' + capitalize(escapeHtml(riskTier)) + '</span>');
        } else {
            setText('patient-risk-tier', '--');
        }

        // Blood test date
        setText('blood-test-date', data.blood_test_date ? formatDate(data.blood_test_date) : '--');

        // -- Consult Call level fields (integer IDs) --

        // Consent status (0=Pending, 1=Obtained, 2=Refused)
        var consentStatus = (data.consent_call_status !== undefined && data.consent_call_status !== null)
            ? String(data.consent_call_status) : CONSENT_PENDING;
        setRadioValue('consent_status', consentStatus);
        handleConsentChange(consentStatus);

        // Consent obtained fields
        if (data.consent_call_date) {
            setInputValue('consent_call_date', data.consent_call_date);
        }
        if (data.scheduled_call_date) {
            setInputValue('scheduled_call_date', data.scheduled_call_date);
        }
        if (data.scheduled_status !== undefined && data.scheduled_status !== null) {
            var scheduledVal = String(data.scheduled_status);
            setRadioValue('scheduled_status', scheduledVal);
            handleScheduledStatusChange(scheduledVal);
        }
        if (data.updated_scheduled_date) {
            setInputValue('updated_scheduled_date', data.updated_scheduled_date);
        }
        if (data.handled_by) {
            setSelectValue('handled_by', data.handled_by);
        }
        if (data.mode_of_consultation !== undefined && data.mode_of_consultation !== null) {
            setRadioValue('mode_of_consultation', String(data.mode_of_consultation));
        }

        // Consent refused fields
        if (data.final_remarks) {
            setInputValue('refusal_remarks', data.final_remarks);
        }

        // -- Detail level fields (from latest detail) --
        var details = data.details || [];
        if (details.length > 0) {
            var detail = details[details.length - 1];
            if (detail.consult_date) {
                setInputValue('consult_date', detail.consult_date);
            }
            if (detail.consulted_by) {
                setSelectValue('consulted_by', detail.consulted_by);
            }
            if (detail.consult_status !== undefined && detail.consult_status !== null) {
                setRadioValue('consult_status', String(detail.consult_status));
            }
            if (detail.diagnosis) {
                setInputValue('diagnosis', detail.diagnosis);
            }
            if (detail.treatment_plan) {
                setInputValue('treatment_plan', detail.treatment_plan);
            }
            if (detail.rx_issued) {
                setCheckboxValue('rx_issued', detail.rx_issued);
            }
            if (detail.action !== undefined && detail.action !== null) {
                setRadioValue('action', String(detail.action));
            }
            if (detail.process_status !== undefined && detail.process_status !== null) {
                // process_status is on detail, not directly editable here but stored
            }
            if (detail.remarks) {
                setInputValue('remarks', detail.remarks);
            }
        }

        // -- Follow-up level fields (from latest follow-up) --
        var followUps = data.follow_ups || [];
        if (followUps.length > 0) {
            var followUp = followUps[followUps.length - 1];
            if (followUp.followup_type !== undefined && followUp.followup_type !== null) {
                setRadioValue('followup_type', String(followUp.followup_type));
            }
            if (followUp.next_followup !== undefined && followUp.next_followup !== null) {
                setRadioValue('next_followup', String(followUp.next_followup));
            }
            if (followUp.followup_date) {
                setInputValue('followup_date', followUp.followup_date);
            }
            if (followUp.is_blood_test_required !== undefined && followUp.is_blood_test_required !== null) {
                setRadioValue('is_blood_test_required', followUp.is_blood_test_required ? '1' : '0');
            }
            if (followUp.mode_of_conversion !== undefined && followUp.mode_of_conversion !== null) {
                setRadioValue('mode_of_conversion', String(followUp.mode_of_conversion));
            }
            if (followUp.referral_to) {
                setSelectValue('referral_to', followUp.referral_to);
            }
            if (followUp.my_referral_status !== undefined && followUp.my_referral_status !== null) {
                setRadioValue('my_referral_status', String(followUp.my_referral_status));
            }
        }

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
                mode_of_conversion: toIntOrNull(getRadioValue('mode_of_conversion')),
                referral_to: toIntOrNull(getSelectValue('referral_to')),
                my_referral_status: toIntOrNull(getRadioValue('my_referral_status'))
            };

            // Send update for the consult call record
            apiCall('update-consult-call', {
                id: EDIT_CONFIG.consultCallId,
                data: consultCallData
            }).then(function(result) {
                if (!result.success) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                    alert('Failed to save consult call: ' + (result.message || 'Unknown error'));
                    return;
                }

                // Also create/update detail if any detail fields are filled
                var hasDetail = detailData.consult_date || detailData.diagnosis ||
                    detailData.treatment_plan || detailData.consult_status !== null;

                var hasFollowUp = followUpData.followup_type !== null ||
                    followUpData.next_followup !== null || followUpData.followup_date;

                var promises = [];

                if (hasDetail) {
                    promises.push(apiCall('create-detail', {
                        consult_call_id: EDIT_CONFIG.consultCallId,
                        data: detailData
                    }));
                }

                if (hasFollowUp) {
                    promises.push(apiCall('create-follow-up', {
                        consult_call_id: EDIT_CONFIG.consultCallId,
                        data: followUpData
                    }));
                }

                if (promises.length > 0) {
                    return Promise.all(promises);
                }
                return null;
            }).then(function() {
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                alert('Changes saved successfully.');
            }).catch(function(err) {
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
        loadConsultCallData();
    });
})();
