/**
 * Telehealth Consultation Dashboard - Main JavaScript
 * API-driven dashboard with fetch-based data loading
 *
 * Status ID reference (from API status libraries):
 *   consent_call_status: 0=Pending, 1=Obtained, 2=Refused
 *   enrollment_type:     1=Primary, 2=Follow Up
 *   process_status:      1=Active, 2=Escalated, 3=Closed
 *   followup_reminder:   0=Pending, 1=Completed, 2=Rescheduled, 3=Cancelled
 *   scheduled_status:    0=Pending, 1=Confirmed, 2=Rescheduled, 3=Cancelled
 *   mode_of_consultation:0=Pending, 1=Phone, 2=Google Meet, 3=WhatsApp
 *   action:              1=Refer Internal, 2=Refer External, 3=End Process
 */
(function() {
    'use strict';

    var currentPage = 1;
    var perPage = 10;
    var searchTimeout = null;

    // Integer ID to label maps for fields not loaded from API
    var LABELS = {
        consent:    { 0: 'Pending', 1: 'Obtained', 2: 'Refused' },
        enrollment: { 1: 'Primary', 2: 'Follow Up' }
    };

    // Integer ID to badge class maps
    var BADGES = {
        consent:    { 0: 'bg-warning',  1: 'bg-success', 2: 'bg-danger' },
        enrollment: { 1: 'bg-primary',  2: 'bg-secondary' },
        process:    { 1: 'bg-success',  2: 'bg-danger',   3: 'bg-secondary' },
        reminder:   { 0: 'bg-warning',  1: 'bg-success',  2: 'bg-info', 3: 'bg-danger' },
        action:     { 1: 'bg-primary',  2: 'bg-info',     3: 'bg-secondary' }
    };

    // Status label maps loaded from StatusLibraryController via get-statuses
    var statusMaps = {
        processStatuses:    {},
        followUpReminders:  {},
        actions:            {}
    };

    /**
     * Load process-statuses and follow-up-reminders from the API status library.
     * Must resolve before the first renderRow() call so labels are available.
     * @returns {Promise}
     */
    function loadStatusMaps() {
        var types = ['process-statuses', 'follow-up-reminders', 'actions'];
        var keys  = ['processStatuses',  'followUpReminders',   'actions'];
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
        return fetch(CC_CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function(response) {
            return response.json();
        });
    }

    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} str Raw string
     * @returns {string} Escaped string safe for innerHTML
     */
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    /**
     * Format a date string to a readable format (e.g., "Mon, 15 Jan 2026")
     * @param {string} dateStr Date string in any parseable format
     * @returns {string} Formatted date string
     */
    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    /**
     * Set text content of an element by ID, with fallback
     * @param {string} id Element ID
     * @param {*} value Value to display
     */
    function setText(id, value) {
        var el = document.getElementById(id);
        if (el) {
            el.textContent = (value !== undefined && value !== null) ? value : '0';
        }
    }

    /**
     * Load summary data from API and update all summary card elements.
     * Summary response uses string keys for sub-groups (e.g. "primary", "follow_up").
     */
    function loadSummary() {
        apiCall('get-summary').then(function(result) {
            if (!result.success || !result.data) return;
            var d = result.data;

            var enroll = d.enrollment_type || {};
            setText('summary-total', d.total || 0);
            setText('summary-enrollment-primary', enroll.primary || 0);
            setText('summary-enrollment-followup', enroll.follow_up || 0);

            var consent = d.consent_call_status || {};
            var consentTotal = (consent.pending || 0) + (consent.obtained || 0) + (consent.refused || 0);
            setText('summary-consent-total', consentTotal);
            setText('summary-consent-pending', consent.pending || 0);
            setText('summary-consent-obtained', consent.obtained || 0);
            setText('summary-consent-refused', consent.refused || 0);

            var process = d.process_status || {};
            var processTotal = (process.active || 0) + (process.escalated || 0) + (process.closed || 0);
            setText('summary-process-total', processTotal);
            setText('summary-process-active', process.active || 0);
            setText('summary-process-closed', process.closed || 0);
            setText('summary-process-escalated', process.escalated || 0);

            var followup = d.followup_reminder || {};
            var followupTotal = (followup.pending || 0) + (followup.completed || 0) + (followup.rescheduled || 0) + (followup.cancelled || 0);
            setText('summary-followup-total', followupTotal);
            setText('summary-followup-pending', followup.pending || 0);
            setText('summary-followup-completed', followup.completed || 0);
            setText('summary-followup-rescheduled', followup.rescheduled || 0);
            setText('summary-followup-cancelled', followup.cancelled || 0);
        }).catch(function(err) {
            console.error('Failed to load summary:', err);
        });
    }

    /**
     * Build filter parameters from the current state of filter DOM elements.
     * Filter values are already integers from the select options.
     * @returns {object} Filter parameters for the API call
     */
    function getFilterParams() {
        var params = {};

        var search = document.getElementById('searchInput').value.trim();
        if (search) params.search = search;

        var consent = document.getElementById('consentFilter').value;
        if (consent !== '') params.consent_call_status = consent;

        var process = document.getElementById('processFilter').value;
        if (process !== '') params.process_status = process;

        var reminder = document.getElementById('reminderFilter').value;
        if (reminder !== '') params.followup_reminder = reminder;

        var enrollment = document.getElementById('enrollmentFilter').value;
        if (enrollment !== '') params.enrollment_type = enrollment;

        var dateFrom = document.getElementById('dateFrom').value;
        if (dateFrom) params.date_from = dateFrom;

        var dateTo = document.getElementById('dateTo').value;
        if (dateTo) params.date_to = dateTo;

        var scheduledFrom = document.getElementById('scheduledFrom').value;
        if (scheduledFrom) params.scheduled_from = scheduledFrom;

        var scheduledTo = document.getElementById('scheduledTo').value;
        if (scheduledTo) params.scheduled_to = scheduledTo;

        var consultedBy = document.getElementById('consultedByFilter').value;
        if (consultedBy !== '') params.consulted_by = consultedBy;

        params.per_page = perPage;
        params.page = currentPage;

        return params;
    }

    /**
     * Show a loading spinner inside the table body
     */
    function showTableLoading() {
        var tbody = document.getElementById('patientsTableBody');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">' +
            '<div class="spinner-border spinner-border-sm text-primary" role="status">' +
            '<span class="visually-hidden">Loading...</span></div>' +
            '<span class="ms-2 text-muted">Loading data...</span></td></tr>';
    }

    /**
     * Show an empty state message in the table body
     * @param {string} message Message to display
     */
    function renderEmptyTable(message) {
        var tbody = document.getElementById('patientsTableBody');
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">' +
            escapeHtml(message || 'No records found') + '</td></tr>';
    }

    /**
     * Render a single table row from a consult call record.
     * Columns: # | CC ID | Patient Details | Process Status | Consent Status |
     *          Enrollment Date | Scheduled Date | Consulted By | Actions
     * @param {object} record Consult call record from API
     * @param {number} index Zero-based index within current page
     * @param {object} customerMap Map of customer_id to customer data from ODB
     * @param {object} outletMap Map of outlet_id to outlet data from ODB
     * @param {object} staffMap Map of staff_id to staff data from ODB
     * @returns {string} HTML string for the table row
     */
    function renderRow(record, index, customerMap, outletMap, staffMap) {
        var rowNum = (currentPage - 1) * perPage + index + 1;
        var customer = (record.customer_id && customerMap[record.customer_id]) ? customerMap[record.customer_id] : {};
        var name  = escapeHtml(customer.name  || '');
        var icno  = escapeHtml(customer.ic    || '');
        var phone = escapeHtml(customer.phone || '');
        var outlet = (record.outlet_id && outletMap[record.outlet_id]) ? outletMap[record.outlet_id] : null;

        var details    = record.details   || [];
        var latestDetail = details.length > 0 ? details[details.length - 1] : null;

        // Status IDs
        var consentId = record.consent_call_status;
        var enrollId  = record.enrollment_type;
        var processId = latestDetail ? latestDetail.process_status : null;

        var actionId     = latestDetail ? latestDetail.action : null;
        var consentLabel = LABELS.consent[consentId]    || '';
        var actionLabel  = actionId !== null ? (statusMaps.actions[String(actionId)] || '') : '';
        var processLabel = processId !== null ? (statusMaps.processStatuses[String(processId)] || '') : '';

        var consentBadge = BADGES.consent[consentId]   || 'bg-secondary';
        var actionBadge  = (actionId !== null && BADGES.action[actionId]) ? BADGES.action[actionId] : 'bg-secondary';
        var processBadge = BADGES.process[processId]   || 'bg-secondary';

        var enrollmentDate  = record.enrollment_date      ? formatDate(record.enrollment_date)      : '<span class="text-muted">-</span>';
        var scheduledDate   = record.scheduled_call_date  ? formatDate(record.scheduled_call_date)  : '<span class="text-muted">-</span>';

        // Consulted by: resolve staff name from staffMap
        var consultedByName = '<span class="text-muted">-</span>';
        if (latestDetail && latestDetail.consulted_by && staffMap[latestDetail.consulted_by]) {
            consultedByName = escapeHtml(staffMap[latestDetail.consulted_by].name || '');
        }

        var ccIdDisplay = escapeHtml('#CC' + record.id);

        var html = '<tr>';
        html += '<td>' + rowNum + '</td>';
        html += '<td><code>' + ccIdDisplay + '</code>'
            + (actionLabel ? '<br><span class="badge ' + actionBadge + ' mt-1">' + escapeHtml(actionLabel) + '</span>' : '')
            + '</td>';

        // Patient Details: name, IC, phone, outlet code (tooltip)
        html += '<td class="patient-details">';
        html += '<div class="fw-medium">' + name + '</div>';
        html += '<small class="text-muted">' + icno + '</small><br>';
        html += '<small class="text-muted"><i class="bi bi-telephone me-1"></i>' + phone + '</small>';
        if (outlet && outlet.code) {
            html += '<br><small class="text-muted" data-bs-toggle="tooltip" data-bs-placement="top" title="' + escapeHtml(outlet.comp_name || '') + '"><i class="bi bi-shop me-1"></i>' + escapeHtml(outlet.code) + '</small>';
        }
        html += '</td>';

        html += '<td><span class="badge ' + processBadge + '">' + escapeHtml(processLabel) + '</span></td>';
        html += '<td><span class="badge ' + consentBadge + '">' + escapeHtml(consentLabel) + '</span></td>';
        html += '<td style="white-space:nowrap">' + enrollmentDate + '</td>';
        html += '<td style="white-space:nowrap">' + scheduledDate + '</td>';
        html += '<td>' + consultedByName + '</td>';
        html += '<td>';
        html += '<a href="consultcall/edit.php?id=' + encodeURIComponent(record.id) + '&view_only=true" class="btn btn-sm btn-outline-primary me-1" title="View"><i class="bi bi-eye"></i></a>';
        html += '<a href="consultcall/edit.php?id=' + encodeURIComponent(record.id) + '" class="btn btn-sm btn-outline-secondary" title="Edit"><i class="bi bi-pencil"></i></a>';
        html += '</td>';
        html += '</tr>';
        return html;
    }

    /**
     * Render pagination controls based on current page state
     * @param {number} totalPages Total number of pages
     * @param {number} total Total number of records
     */
    function renderPagination(totalPages, total) {
        var paginationInfo = document.getElementById('paginationInfo');
        var paginationControls = document.getElementById('paginationControls');

        if (totalPages < 1) totalPages = 1;
        var startRow = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
        var endRow = Math.min(currentPage * perPage, total);
        paginationInfo.textContent = 'Showing ' + startRow + ' to ' + endRow + ' of ' + total + ' entries';

        var html = '';

        html += '<li class="page-item ' + (currentPage === 1 ? 'disabled' : '') + '">';
        html += '<a class="page-link" href="#" data-page="prev">Previous</a></li>';

        var startPage = Math.max(1, currentPage - 2);
        var endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            html += '<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>';
            if (startPage > 2) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
        }

        for (var p = startPage; p <= endPage; p++) {
            html += '<li class="page-item ' + (p === currentPage ? 'active' : '') + '">';
            html += '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a></li>';
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
            html += '<li class="page-item"><a class="page-link" href="#" data-page="' + totalPages + '">' + totalPages + '</a></li>';
        }

        html += '<li class="page-item ' + (currentPage === totalPages ? 'disabled' : '') + '">';
        html += '<a class="page-link" href="#" data-page="next">Next</a></li>';

        paginationControls.innerHTML = html;

        var pageLinks = paginationControls.getElementsByTagName('a');
        for (var k = 0; k < pageLinks.length; k++) {
            pageLinks[k].addEventListener('click', handlePageClick);
        }
    }

    /**
     * Handle pagination link clicks
     * @param {Event} e Click event
     */
    function handlePageClick(e) {
        e.preventDefault();
        var page = this.getAttribute('data-page');
        if (page === 'prev') {
            if (currentPage > 1) currentPage--;
        } else if (page === 'next') {
            currentPage++;
        } else {
            currentPage = parseInt(page, 10);
        }
        loadTableData();
    }

    /**
     * Load table data from API based on current filters and page.
     * After fetching consult calls, batch-fetches customer details from ODB
     * using the customer_id field on each record.
     */
    function loadTableData() {
        showTableLoading();
        var params = getFilterParams();
        apiCall('all-consult-call', params).then(function(result) {
            if (!result.success) {
                renderEmptyTable(result.message || 'Failed to load data');
                renderPagination(1, 0);
                return;
            }

            var data = result.data;
            var records = data.data || [];
            var totalPages = data.last_page || 1;
            var total = data.total || 0;
            currentPage = data.current_page || 1;

            if (records.length === 0) {
                renderEmptyTable('No records found');
                renderPagination(totalPages, total);
                return;
            }

            // Collect unique customer_ids, outlet_ids, and consulted_by staff_ids from records
            var customerIds = [];
            var outletIds = [];
            var staffIds = [];
            var seenCustomers = {};
            var seenOutlets = {};
            var seenStaff = {};
            for (var i = 0; i < records.length; i++) {
                var cid = records[i].customer_id;
                if (cid && !seenCustomers[cid]) {
                    customerIds.push(cid);
                    seenCustomers[cid] = true;
                }
                var oid = records[i].outlet_id;
                if (oid && !seenOutlets[oid]) {
                    outletIds.push(oid);
                    seenOutlets[oid] = true;
                }
                var details = records[i].details || [];
                var latestDetail = details.length > 0 ? details[details.length - 1] : null;
                var sid = latestDetail ? latestDetail.consulted_by : null;
                if (sid && !seenStaff[sid]) {
                    staffIds.push(sid);
                    seenStaff[sid] = true;
                }
            }

            var customerPromise = customerIds.length > 0
                ? apiCall('get-customers', { customer_ids: customerIds })
                : Promise.resolve({ success: true, data: {} });

            var outletPromise = outletIds.length > 0
                ? apiCall('get-outlets', { outlet_ids: outletIds })
                : Promise.resolve({ success: true, data: {} });

            var staffPromise = staffIds.length > 0
                ? apiCall('get-staff', { staff_ids: staffIds })
                : Promise.resolve({ success: true, data: {} });

            Promise.all([customerPromise, outletPromise, staffPromise]).then(function(results) {
                var customerMap = (results[0].success && results[0].data) ? results[0].data : {};
                var outletMap   = (results[1].success && results[1].data) ? results[1].data : {};
                var staffMap    = (results[2].success && results[2].data) ? results[2].data : {};
                renderTableRows(records, customerMap, outletMap, staffMap);
                renderPagination(totalPages, total);
            }).catch(function() {
                renderTableRows(records, {}, {}, {});
                renderPagination(totalPages, total);
            });
        }).catch(function(err) {
            console.error('Failed to load table data:', err);
            renderEmptyTable('Error loading data. Please try again.');
            renderPagination(1, 0);
        });
    }

    /**
     * Render all table rows with customer, outlet, and staff data.
     * Initializes Bootstrap tooltips on outlet code spans after rendering.
     * @param {Array} records Consult call records
     * @param {object} customerMap Customer data keyed by customer_id
     * @param {object} outletMap Outlet data keyed by outlet_id
     * @param {object} staffMap Staff data keyed by staff_id
     */
    function renderTableRows(records, customerMap, outletMap, staffMap) {
        var tbody = document.getElementById('patientsTableBody');
        var html = '';
        for (var i = 0; i < records.length; i++) {
            html += renderRow(records[i], i, customerMap, outletMap, staffMap);
        }
        tbody.innerHTML = html;

        var tooltipEls = tbody.querySelectorAll('[data-bs-toggle="tooltip"]');
        for (var t = 0; t < tooltipEls.length; t++) {
            new bootstrap.Tooltip(tooltipEls[t]);
        }
    }

    /**
     * Return the CSS modifier class for a follow-up chip based on how soon the date is.
     * @param {Date} date Normalised (midnight) Date object
     * @returns {string}
     */
    function getChipClass(date) {
        var today    = new Date(); today.setHours(0, 0, 0, 0);
        var tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        if (date.getTime() === today.getTime())    return 'followup-chip-today';
        if (date.getTime() === tomorrow.getTime()) return 'followup-chip-tomorrow';
        return 'followup-chip-week';
    }

    /**
     * Format a normalised Date for display inside a chip.
     * @param {Date} date
     * @returns {string}
     */
    function formatChipDate(date) {
        var today    = new Date(); today.setHours(0, 0, 0, 0);
        var tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        var days   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var dm = date.getDate() + ' ' + months[date.getMonth()];
        if (date.getTime() === today.getTime())    return 'Today \u2014 ' + dm;
        if (date.getTime() === tomorrow.getTime()) return 'Tomorrow \u2014 ' + dm;
        return days[date.getDay()] + ', ' + dm;
    }

    /**
     * Render the empty state inside the follow-up banner.
     */
    function renderBannerEmpty() {
        var countEl = document.getElementById('followup-banner-count');
        var wrapper = document.getElementById('followup-chips-wrapper');
        if (countEl) countEl.textContent = '0';
        if (wrapper) {
            wrapper.innerHTML = '<span class="text-muted" style="font-size: 13px; padding: 6px 2px;">No upcoming follow-ups in the next 7 days.</span>';
        }
    }

    /**
     * Render follow-up chips after customer names have been resolved.
     * @param {Array}  upcoming    Sorted array of { id, customer_id, followup_date }
     * @param {object} customerMap customer_id -> customer object from ODB
     */
    function renderBannerChips(upcoming, customerMap) {
        var countEl = document.getElementById('followup-banner-count');
        var wrapper = document.getElementById('followup-chips-wrapper');
        if (countEl) countEl.textContent = upcoming.length;
        if (!wrapper) return;

        var html = '';
        for (var i = 0; i < upcoming.length; i++) {
            var item      = upcoming[i];
            var customer  = customerMap[item.customer_id] || {};
            var name      = customer.name || 'Unknown Patient';
            var chipClass = getChipClass(item.followup_date);
            var dateLabel = formatChipDate(item.followup_date);

            html += '<a href="consultcall/edit.php?id=' + encodeURIComponent(item.id) + '" class="followup-chip ' + chipClass + '">';
            html += '<span class="followup-chip-date">'  + escapeHtml(dateLabel) + '</span>';
            html += '<span class="followup-chip-name">'  + escapeHtml(name)      + '</span>';
            html += '<span class="followup-chip-meta">#CC' + escapeHtml(String(item.id)) + '</span>';
            html += '</a>';
        }
        wrapper.innerHTML = html;
    }

    /**
     * Fetch pending follow-ups from the API, filter to those due within the next 7 days,
     * resolve customer names, then render the reminder banner.
     */
    function loadFollowupBanner() {
        var today = new Date(); today.setHours(0, 0, 0, 0);
        var cutoff = new Date(today); cutoff.setDate(today.getDate() + 7);

        apiCall('all-consult-call', { followup_reminder: 0, per_page: 9999, page: 1 })
            .then(function(result) {
                if (!result.success || !result.data) { renderBannerEmpty(); return; }

                var records  = result.data.data || [];
                var upcoming = [];

                for (var i = 0; i < records.length; i++) {
                    var r  = records[i];
                    var fu = r.follow_ups || [];
                    if (fu.length === 0) continue;
                    var latest = fu[fu.length - 1];
                    if (!latest.followup_date) continue;

                    var fuDate = new Date(latest.followup_date);
                    fuDate.setHours(0, 0, 0, 0);

                    if (fuDate >= today && fuDate <= cutoff) {
                        upcoming.push({ id: r.id, customer_id: r.customer_id, followup_date: fuDate });
                    }
                }

                if (upcoming.length === 0) { renderBannerEmpty(); return; }

                // Sort soonest first
                upcoming.sort(function(a, b) { return a.followup_date - b.followup_date; });

                // Batch-fetch customer names
                var customerIds = [];
                var seen = {};
                for (var j = 0; j < upcoming.length; j++) {
                    var cid = upcoming[j].customer_id;
                    if (cid && !seen[cid]) { customerIds.push(cid); seen[cid] = true; }
                }

                var custPromise = customerIds.length > 0
                    ? apiCall('get-customers', { customer_ids: customerIds })
                    : Promise.resolve({ success: true, data: {} });

                custPromise.then(function(custResult) {
                    var customerMap = (custResult.success && custResult.data) ? custResult.data : {};
                    renderBannerChips(upcoming, customerMap);
                }).catch(function() {
                    renderBannerChips(upcoming, {});
                });
            })
            .catch(function() { renderBannerEmpty(); });
    }

    /**
     * Handle a card summary row click: clear all dropdowns, apply the clicked filter, reload.
     * @param {Event} e Click event
     */
    function handleCardFilterClick(e) {
        var field = this.getAttribute('data-filter-field');
        var value = this.getAttribute('data-filter-value');

        document.getElementById('searchInput').value = '';
        document.getElementById('consentFilter').value = '';
        document.getElementById('processFilter').value = '';
        document.getElementById('reminderFilter').value = '';
        document.getElementById('enrollmentFilter').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('scheduledFrom').value = '';
        document.getElementById('scheduledTo').value = '';
        document.getElementById('consultedByFilter').value = '';

        var el = document.getElementById(field);
        if (el) {
            el.value = value;
        }

        currentPage = 1;
        loadTableData();
    }

    /**
     * Reset all filter inputs and reload table data
     */
    function resetFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('consentFilter').value = '';
        document.getElementById('processFilter').value = '';
        document.getElementById('reminderFilter').value = '';
        document.getElementById('enrollmentFilter').value = '';
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value = '';
        document.getElementById('scheduledFrom').value = '';
        document.getElementById('scheduledTo').value = '';
        document.getElementById('consultedByFilter').value = '';
        currentPage = 1;
        loadTableData();
    }

    /**
     * Handle filter change: reset to page 1 and reload
     */
    function onFilterChange() {
        currentPage = 1;
        loadTableData();
    }

    /**
     * Handle search input with debounce
     */
    function onSearchKeyup() {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
            currentPage = 1;
            loadTableData();
        }, 400);
    }

    /**
     * Initialize all event listeners and load initial data
     */
    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('searchInput').addEventListener('keyup', onSearchKeyup);

        document.getElementById('consentFilter').addEventListener('change', onFilterChange);
        document.getElementById('processFilter').addEventListener('change', onFilterChange);
        document.getElementById('reminderFilter').addEventListener('change', onFilterChange);
        document.getElementById('enrollmentFilter').addEventListener('change', onFilterChange);

        document.getElementById('dateFrom').addEventListener('change', onFilterChange);
        document.getElementById('dateTo').addEventListener('change', onFilterChange);
        document.getElementById('scheduledFrom').addEventListener('change', onFilterChange);
        document.getElementById('scheduledTo').addEventListener('change', onFilterChange);
        document.getElementById('consultedByFilter').addEventListener('change', onFilterChange);

        document.getElementById('resetBtn').addEventListener('click', resetFilters);

        var filterRows = document.querySelectorAll('.card-filter-row');
        for (var f = 0; f < filterRows.length; f++) {
            filterRows[f].addEventListener('click', handleCardFilterClick);
        }

        document.getElementById('rowsPerPage').addEventListener('change', function() {
            perPage = parseInt(this.value, 10);
            currentPage = 1;
            loadTableData();
        });

        loadFollowupBanner();
        loadSummary();
        loadStatusMaps().then(function() {
            loadTableData();
        });
    });
})();
