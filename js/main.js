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
 */
(function() {
    'use strict';

    var currentPage = 1;
    var perPage = 10;
    var searchTimeout = null;

    // Integer ID to label maps (from API status libraries)
    var LABELS = {
        consent:    { 0: 'Pending', 1: 'Obtained', 2: 'Refused' },
        enrollment: { 1: 'Primary', 2: 'Follow Up' },
        process:    { 1: 'Active', 2: 'Escalated', 3: 'Closed' },
        reminder:   { 0: 'Pending', 1: 'Completed', 2: 'Rescheduled', 3: 'Cancelled' }
    };

    // Integer ID to badge class maps
    var BADGES = {
        consent:    { 0: 'bg-warning', 1: 'bg-success', 2: 'bg-danger' },
        enrollment: { 1: 'bg-primary', 2: 'bg-secondary' },
        process:    { 1: 'bg-success', 2: 'bg-danger', 3: 'bg-secondary' },
        reminder:   { 0: 'bg-warning', 1: 'bg-success', 2: 'bg-info', 3: 'bg-danger' }
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

        var lastConsultFrom = document.getElementById('lastConsultFrom').value;
        if (lastConsultFrom) params.last_consult_from = lastConsultFrom;

        var lastConsultTo = document.getElementById('lastConsultTo').value;
        if (lastConsultTo) params.last_consult_to = lastConsultTo;

        params.per_page = perPage;
        params.page = currentPage;

        return params;
    }

    /**
     * Show a loading spinner inside the table body
     */
    function showTableLoading() {
        var tbody = document.getElementById('patientsTableBody');
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4">' +
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
        tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4 text-muted">' +
            escapeHtml(message || 'No records found') + '</td></tr>';
    }

    /**
     * Render a single table row from a consult call record.
     * All status fields are integer IDs resolved via LABELS/BADGES maps.
     * Customer details come from the ODB customer table (passed via customerMap).
     * @param {object} record Consult call record from API
     * @param {number} index Zero-based index within current page
     * @param {object} customerMap Map of customer_id to customer data from ODB
     * @returns {string} HTML string for the table row
     */
    function renderRow(record, index, customerMap) {
        var rowNum = (currentPage - 1) * perPage + index + 1;
        var customer = (record.customer_id && customerMap[record.customer_id]) ? customerMap[record.customer_id] : {};
        var name = escapeHtml(customer.name || '--');
        var icno = escapeHtml(customer.ic || '--');
        var phone = escapeHtml(customer.phone || '--');

        // Resolve integer IDs to labels and badge classes
        var consentId = record.consent_call_status;
        var enrollId = record.enrollment_type;
        var processId = record.process_status;
        var reminderId = record.followup_reminder;

        var consentLabel = LABELS.consent[consentId] || '--';
        var enrollLabel = LABELS.enrollment[enrollId] || '--';
        var processLabel = LABELS.process[processId] || '--';
        var reminderLabel = LABELS.reminder[reminderId] || '--';

        var consentBadge = BADGES.consent[consentId] || 'bg-secondary';
        var enrollBadge = BADGES.enrollment[enrollId] || 'bg-secondary';
        var processBadge = BADGES.process[processId] || 'bg-secondary';
        var reminderBadge = BADGES.reminder[reminderId] || 'bg-secondary';

        var enrollmentDate = record.enrollment_date ? formatDate(record.enrollment_date) : '--';

        // Last consultation: derive from latest detail consult_date or follow-up
        var lastConsult = '';
        var details = record.details || [];
        if (details.length > 0) {
            var latestDetail = details[details.length - 1];
            if (latestDetail.consult_date) {
                lastConsult = formatDate(latestDetail.consult_date);
            }
        }
        if (!lastConsult) {
            lastConsult = '<span class="text-muted">-</span>';
        }

        var ccIdDisplay = escapeHtml('#CC' + record.id);

        var html = '<tr>';
        html += '<td>' + rowNum + '</td>';
        html += '<td><code>' + ccIdDisplay + '</code></td>';
        html += '<td class="patient-details">';
        html += '<div class="fw-medium">' + name + '</div>';
        html += '<small class="text-muted">' + icno + '</small><br>';
        html += '<small class="text-muted"><i class="bi bi-telephone me-1"></i>' + phone + '</small>';
        html += '</td>';
        html += '<td><span class="badge ' + enrollBadge + '">' + escapeHtml(enrollLabel) + '</span></td>';
        html += '<td><span class="badge ' + consentBadge + '">' + escapeHtml(consentLabel) + '</span></td>';
        html += '<td><span class="badge ' + processBadge + '">' + escapeHtml(processLabel) + '</span></td>';
        html += '<td><span class="badge ' + reminderBadge + '">' + escapeHtml(reminderLabel) + '</span></td>';
        html += '<td>' + enrollmentDate + '</td>';
        html += '<td>' + lastConsult + '</td>';
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

            // Collect unique customer_ids from records
            var customerIds = [];
            var seen = {};
            for (var i = 0; i < records.length; i++) {
                var cid = records[i].customer_id;
                if (cid && !seen[cid]) {
                    customerIds.push(cid);
                    seen[cid] = true;
                }
            }

            // Batch-fetch customer details from ODB, then render rows
            if (customerIds.length > 0) {
                apiCall('get-customers', { customer_ids: customerIds }).then(function(custResult) {
                    var customerMap = (custResult.success && custResult.data) ? custResult.data : {};
                    renderTableRows(records, customerMap);
                    renderPagination(totalPages, total);
                }).catch(function() {
                    // Render without customer details on failure
                    renderTableRows(records, {});
                    renderPagination(totalPages, total);
                });
            } else {
                renderTableRows(records, {});
                renderPagination(totalPages, total);
            }
        }).catch(function(err) {
            console.error('Failed to load table data:', err);
            renderEmptyTable('Error loading data. Please try again.');
            renderPagination(1, 0);
        });
    }

    /**
     * Render all table rows with customer data
     * @param {Array} records Consult call records
     * @param {object} customerMap Customer data keyed by customer_id
     */
    function renderTableRows(records, customerMap) {
        var tbody = document.getElementById('patientsTableBody');
        var html = '';
        for (var i = 0; i < records.length; i++) {
            html += renderRow(records[i], i, customerMap);
        }
        tbody.innerHTML = html;
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
        document.getElementById('lastConsultFrom').value = '';
        document.getElementById('lastConsultTo').value = '';
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
        document.getElementById('lastConsultFrom').addEventListener('change', onFilterChange);
        document.getElementById('lastConsultTo').addEventListener('change', onFilterChange);

        document.getElementById('filterBtn').addEventListener('click', onFilterChange);
        document.getElementById('resetBtn').addEventListener('click', resetFilters);

        document.getElementById('rowsPerPage').addEventListener('change', function() {
            perPage = parseInt(this.value, 10);
            currentPage = 1;
            loadTableData();
        });

        loadSummary();
        loadTableData();
    });
})();
