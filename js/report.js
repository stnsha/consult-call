/**
 * Consult Call Report - JavaScript
 *
 * Loads all consult call records matching the current filters (up to 9999),
 * batch-fetches customer/outlet/staff lookups from ODB, then aggregates
 * data client-side into 13 charts (12 doughnut breakdowns + 1 horizontal
 * bar chart for enrollment by outlet) and a CSV export.
 *
 * Status reference:
 *   consent_call_status:   0=Pending, 1=Obtained, 2=Refused, 3=On Medication
 *   enrollment_type:       1=Primary, 2=Follow Up
 *   scheduled_status:      0=Pending, 1=Confirmed, 2=Rescheduled, 3=Cancelled
 *   mode_of_consultation:  0=Pending, 1=Phone, 2=Google Meet, 3=WhatsApp
 *   consult_status:        0=Pending, 1=Completed, 2=No Show, 3=Cancelled
 *   process_status:        1=Active, 2=Escalated, 3=Closed
 *   action:                1=Refer Internal, 2=Refer External, 3=End Process
 *   followup_type:         0=None, 1=Blood Test + Review, 2=Review Only
 *   next_followup:         0=None, 1=1 Month, 2=3 Months, 3=6 Months
 *   followup_reminder:     0=Pending, 1=Completed, 2=Rescheduled, 3=Cancelled
 */
(function() {
    'use strict';

    // Status ID to label maps
    var LABELS = {
        enrollment:  { '1': 'Primary', '2': 'Follow Up' },
        consent:     { '0': 'Pending', '1': 'Obtained', '2': 'Refused', '3': 'On Medication' },
        scheduled:   { '0': 'Pending', '1': 'Confirmed', '2': 'Rescheduled', '3': 'Cancelled' },
        modeConsult: { '0': 'Pending', '1': 'Phone', '2': 'Google Meet', '3': 'WhatsApp' },
        process:     { '1': 'Active', '2': 'Escalated', '3': 'Closed' },
        consultSt:   { '0': 'Pending', '1': 'Completed', '2': 'No Show', '3': 'Cancelled' },
        action:      { '1': 'Refer Internal', '2': 'Refer External', '3': 'End Process' },
        followupType:{ '0': 'None', '1': 'Blood Test + Review', '2': 'Review Only' },
        nextFollowup:{ '0': 'None', '1': '1 Month', '2': '3 Months', '3': '6 Months' },
        reminder:    { '0': 'Pending', '1': 'Completed', '2': 'Rescheduled', '3': 'Cancelled' }
    };

    // Semantic colors keyed by display label
    var LABEL_COLORS = {
        'Pending':             '#ffc107',
        'Obtained':            '#198754',
        'Refused':             '#dc3545',
        'On Medication':       '#0dcaf0',
        'Active':              '#198754',
        'Escalated':           '#dc3545',
        'Closed':              '#6c757d',
        'Primary':             '#0d6efd',
        'Follow Up':           '#6c757d',
        'Confirmed':           '#198754',
        'Rescheduled':         '#0dcaf0',
        'Cancelled':           '#dc3545',
        'Completed':           '#198754',
        'No Show':             '#dc3545',
        'Phone':               '#0d6efd',
        'Google Meet':         '#198754',
        'WhatsApp':            '#0dcaf0',
        'Refer Internal':      '#0d6efd',
        'Refer External':      '#0dcaf0',
        'End Process':         '#6c757d',
        'None':                '#adb5bd',
        'Blood Test + Review': '#0dcaf0',
        'Review Only':         '#0d6efd',
        '1 Month':             '#198754',
        '3 Months':            '#0d6efd',
        '6 Months':            '#ffc107',
        'Issued':              '#198754',
        'Not Issued':          '#dc3545',
        'No Detail':           '#e9ecef',
        'Required':            '#0dcaf0',
        'Not Required':        '#6c757d',
        'No Follow-up':        '#e9ecef',
        'Not Set':             '#e9ecef',
        'Not Assigned':        '#e9ecef'
    };

    // Fallback color palette for labels not in LABEL_COLORS
    var PALETTE = ['#0d6efd','#198754','#ffc107','#dc3545','#0dcaf0','#fd7e14','#6f42c1','#20c997','#6c757d','#adb5bd'];

    // Loaded data
    var allRecords  = [];
    var customerMap = {};
    var staffMap    = {};
    var outletMap   = {};

    // Active Chart.js instances keyed by canvas ID, used for cleanup on re-render
    var chartInstances = {};

    // ---------------------------------------------------------------------------
    // API
    // ---------------------------------------------------------------------------

    function apiCall(action, data) {
        var body = { action: action };
        if (data) {
            for (var key in data) {
                if (data.hasOwnProperty(key)) body[key] = data[key];
            }
        }
        return fetch(REPORT_CONFIG.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(function(res) { return res.json(); });
    }

    // ---------------------------------------------------------------------------
    // Utility
    // ---------------------------------------------------------------------------

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    }

    function formatDatetime(dateStr) {
        if (!dateStr) return '';
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var hh = String(d.getHours());
        var mm = String(d.getMinutes());
        if (hh.length < 2) hh = '0' + hh;
        if (mm.length < 2) mm = '0' + mm;
        return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() + ' ' + hh + ':' + mm;
    }

    function getLatestDetail(record) {
        var d = record.details || [];
        return d.length > 0 ? d[d.length - 1] : null;
    }

    function getLatestFollowUp(record) {
        var f = record.follow_ups || [];
        return f.length > 0 ? f[f.length - 1] : null;
    }

    /**
     * Count occurrences of values returned by getVal across allRecords.
     * Null/undefined values are grouped under '__null__'.
     */
    function countBy(getVal) {
        var counts = {};
        for (var i = 0; i < allRecords.length; i++) {
            var val = getVal(allRecords[i]);
            var key = (val === null || val === undefined) ? '__null__' : String(val);
            counts[key] = (counts[key] || 0) + 1;
        }
        return counts;
    }

    // ---------------------------------------------------------------------------
    // Filter helpers
    // ---------------------------------------------------------------------------

    function getFilterParams() {
        var params = { per_page: 9999, page: 1 };
        var dateFrom = document.getElementById('dateFrom').value;
        if (dateFrom) params.date_from = dateFrom;
        var dateTo = document.getElementById('dateTo').value;
        if (dateTo) params.date_to = dateTo;
        var consent = document.getElementById('consentFilter').value;
        if (consent !== '') params.consent_call_status = consent;
        var process = document.getElementById('processFilter').value;
        if (process !== '') params.process_status = process;
        var enrollment = document.getElementById('enrollmentFilter').value;
        if (enrollment !== '') params.enrollment_type = enrollment;
        var consultedBy = document.getElementById('consultedByFilter').value;
        if (consultedBy !== '') params.consulted_by = consultedBy;
        return params;
    }

    function buildFilterDesc() {
        var parts = [];
        var dateFrom = document.getElementById('dateFrom').value;
        var dateTo   = document.getElementById('dateTo').value;
        if (dateFrom || dateTo) {
            parts.push('Enrollment: ' + (dateFrom ? formatDate(dateFrom) : 'start') + ' to ' + (dateTo ? formatDate(dateTo) : 'today'));
        }
        var consent = document.getElementById('consentFilter');
        if (consent.value !== '') parts.push('Consent: ' + consent.options[consent.selectedIndex].text);
        var process = document.getElementById('processFilter');
        if (process.value !== '') parts.push('Process: ' + process.options[process.selectedIndex].text);
        var enrollment = document.getElementById('enrollmentFilter');
        if (enrollment.value !== '') parts.push('Type: ' + enrollment.options[enrollment.selectedIndex].text);
        var consultedBy = document.getElementById('consultedByFilter');
        if (consultedBy.value !== '') parts.push('Consulted by: ' + consultedBy.options[consultedBy.selectedIndex].text);
        return parts.length > 0 ? parts.join('  |  ') : 'All records (no filter applied)';
    }

    function showLoading(state) {
        var overlay = document.getElementById('loadingOverlay');
        var content = document.getElementById('reportContent');
        if (overlay) overlay.style.display = state ? 'flex' : 'none';
        if (content) content.style.display = state ? 'none' : 'block';
    }

    // ---------------------------------------------------------------------------
    // Chart helpers
    // ---------------------------------------------------------------------------

    /**
     * Destroy an existing Chart.js instance on a canvas before recreating it.
     * Prevents the "Canvas is already in use" error when filters are re-applied.
     */
    function destroyChart(canvasId) {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
            chartInstances[canvasId] = null;
        }
    }

    /**
     * Build a label/data/color triple from a counts map and label map,
     * sorted by count descending.
     * @returns {object} { labels, data, colors }
     */
    function buildChartData(counts, labelMap) {
        var keys = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; });
        var labels = [];
        var data   = [];
        var colors = [];
        var pi = 0;

        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var label = (k === '__null__') ? 'Not Set' : (labelMap[k] !== undefined ? labelMap[k] : ('Value ' + k));
            labels.push(label);
            data.push(counts[k]);
            colors.push(LABEL_COLORS[label] !== undefined ? LABEL_COLORS[label] : PALETTE[pi % PALETTE.length]);
            pi++;
        }

        return { labels: labels, data: data, colors: colors };
    }

    /**
     * Render a doughnut chart.
     * If counts is empty, shows a "No data" message in the container instead.
     * @param {string} canvasId Canvas element ID
     * @param {object} counts   Map of key -> count
     * @param {object} labelMap Map of key -> display label
     */
    function renderDoughnut(canvasId, counts, labelMap) {
        destroyChart(canvasId);

        var canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (Object.keys(counts).length === 0) {
            canvas.style.display = 'none';
            var empty = document.createElement('p');
            empty.className = 'text-center text-muted small pt-4';
            empty.textContent = 'No data';
            canvas.parentNode.appendChild(empty);
            return;
        }

        canvas.style.display = '';

        var cd = buildChartData(counts, labelMap);

        chartInstances[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: cd.labels,
                datasets: [{
                    data: cd.data,
                    backgroundColor: cd.colors,
                    borderColor: '#fff',
                    borderWidth: 2,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 11, family: 'Inter, sans-serif' },
                            boxWidth: 12,
                            padding: 8,
                            color: '#495057'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                var total = 0;
                                var dataset = context.dataset.data;
                                for (var i = 0; i < dataset.length; i++) total += dataset[i];
                                var pct = total > 0 ? (context.raw / total * 100).toFixed(1) : '0.0';
                                return ' ' + context.label + ': ' + context.raw + ' (' + pct + '%)';
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Render the outlet enrollment horizontal bar chart.
     * Computes counts from allRecords.outlet_id, resolves outlet names from outletMap,
     * and adjusts the canvas container height dynamically based on number of outlets.
     */
    function renderOutletChart() {
        destroyChart('chart-outlets');

        var canvas    = document.getElementById('chart-outlets');
        var container = document.getElementById('chart-outlets-container');
        var emptyMsg  = document.getElementById('chart-outlets-empty');

        if (!canvas) return;

        // Count by outlet_id
        var outletCounts = {};
        for (var i = 0; i < allRecords.length; i++) {
            var oid = allRecords[i].outlet_id;
            var key = (oid !== null && oid !== undefined) ? String(oid) : '__none__';
            outletCounts[key] = (outletCounts[key] || 0) + 1;
        }

        // Build sorted label/data pairs
        var pairs = [];
        for (var k in outletCounts) {
            var outlet = outletMap[k] || null;
            var label;
            if (k === '__none__') {
                label = 'Not Assigned';
            } else if (outlet) {
                label = outlet.code ? (outlet.code + ' - ' + outlet.comp_name) : outlet.comp_name;
            } else {
                label = 'Outlet ' + k;
            }
            pairs.push({ label: label, count: outletCounts[k] });
        }
        pairs.sort(function(a, b) { return b.count - a.count; });

        if (pairs.length === 0) {
            canvas.style.display = 'none';
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }

        canvas.style.display = '';
        if (emptyMsg) emptyMsg.style.display = 'none';

        var labels = [];
        var data   = [];
        for (var j = 0; j < pairs.length; j++) {
            labels.push(pairs[j].label);
            data.push(pairs[j].count);
        }

        // Dynamically size the container: 36px per bar + 60px for axes and padding
        var dynamicHeight = Math.max(200, labels.length * 36 + 60);
        if (container) container.style.height = dynamicHeight + 'px';

        // Generate a blue gradient across bars from dark to light
        var barColors = [];
        for (var b = 0; b < labels.length; b++) {
            var opacity = Math.max(0.4, 1 - b * 0.05);
            barColors.push('rgba(13, 110, 253, ' + opacity + ')');
        }

        chartInstances['chart-outlets'] = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Enrolled',
                    data: data,
                    backgroundColor: barColors,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ' Enrolled: ' + context.raw;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                            font: { size: 11, family: 'Inter, sans-serif' },
                            color: '#6c757d'
                        },
                        grid: { color: '#f0f0f0' }
                    },
                    y: {
                        ticks: {
                            font: { size: 11, family: 'Inter, sans-serif' },
                            color: '#495057'
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // ---------------------------------------------------------------------------
    // Main render orchestrator
    // ---------------------------------------------------------------------------

    function renderReport() {
        var total = allRecords.length;

        // Update summary cards
        document.getElementById('report-total').textContent = total;

        // Show record count badge in header
        var badge = document.getElementById('report-record-badge');
        var badgeCount = document.getElementById('report-total-badge');
        if (badge && badgeCount) {
            badgeCount.textContent = total;
            badge.style.display = 'inline-block';
        }

        // Outlet enrollment bar chart
        renderOutletChart();

        // Row 1
        renderDoughnut('chart-enrollment', countBy(function(r) { return r.enrollment_type; }), LABELS.enrollment);
        renderDoughnut('chart-consent',    countBy(function(r) { return r.consent_call_status; }), LABELS.consent);
        renderDoughnut('chart-scheduled',  countBy(function(r) { return r.scheduled_status; }), LABELS.scheduled);

        // Row 2
        renderDoughnut('chart-mode-consult',   countBy(function(r) { return r.mode_of_consultation; }), LABELS.modeConsult);
        renderDoughnut('chart-process',        countBy(function(r) { var d = getLatestDetail(r); return d ? d.process_status : null; }), LABELS.process);
        renderDoughnut('chart-consult-status', countBy(function(r) { var d = getLatestDetail(r); return d ? d.consult_status : null; }), LABELS.consultSt);

    }

    // ---------------------------------------------------------------------------
    // Data loading
    // ---------------------------------------------------------------------------

    function loadReport() {
        showLoading(true);

        var params = getFilterParams();

        apiCall('all-consult-call', params).then(function(res) {
            if (!res.success) {
                showLoading(false);
                alert('Failed to load report data: ' + (res.message || 'Unknown error'));
                return;
            }

            var pageData = res.data;
            allRecords = (pageData && pageData.data) ? pageData.data : [];

            // Collect unique IDs for batch ODB lookups
            var customerIds = [], outletIds = [], staffIds = [];
            var seenC = {}, seenO = {}, seenS = {};

            for (var i = 0; i < allRecords.length; i++) {
                var r = allRecords[i];

                if (r.customer_id && !seenC[r.customer_id]) {
                    customerIds.push(r.customer_id);
                    seenC[r.customer_id] = true;
                }
                if (r.outlet_id && !seenO[r.outlet_id]) {
                    outletIds.push(r.outlet_id);
                    seenO[r.outlet_id] = true;
                }
                if (r.handled_by && !seenS[r.handled_by]) {
                    staffIds.push(r.handled_by);
                    seenS[r.handled_by] = true;
                }
                var det = getLatestDetail(r);
                if (det && det.consulted_by && !seenS[det.consulted_by]) {
                    staffIds.push(det.consulted_by);
                    seenS[det.consulted_by] = true;
                }
            }

            var cProm = customerIds.length > 0
                ? apiCall('get-customers', { customer_ids: customerIds })
                : Promise.resolve({ success: true, data: {} });

            var oProm = outletIds.length > 0
                ? apiCall('get-outlets', { outlet_ids: outletIds })
                : Promise.resolve({ success: true, data: {} });

            var sProm = staffIds.length > 0
                ? apiCall('get-staff', { staff_ids: staffIds })
                : Promise.resolve({ success: true, data: {} });

            return Promise.all([cProm, oProm, sProm]).then(function(results) {
                customerMap = (results[0].success && results[0].data) ? results[0].data : {};
                outletMap   = (results[1].success && results[1].data) ? results[1].data : {};
                staffMap    = (results[2].success && results[2].data) ? results[2].data : {};

                document.getElementById('report-generated').textContent    = new Date().toLocaleString('en-MY');
                document.getElementById('report-filter-desc').textContent  = buildFilterDesc();

                renderReport();
                showLoading(false);
            });

        }).catch(function(err) {
            showLoading(false);
            alert('Error loading report: ' + err.message);
        });
    }

    // ---------------------------------------------------------------------------
    // CSV Export
    // ---------------------------------------------------------------------------

    function exportCSV() {
        if (allRecords.length === 0) {
            alert('No data to export. Please load the report first.');
            return;
        }

        var headers = [
            'CC ID', 'Customer ID', 'Patient Name', 'IC No', 'Phone', 'Gender', 'Age',
            'Outlet Code', 'Outlet Name',
            'Enrollment Date', 'Enrollment Type',
            'Consent Status', 'Consent Date',
            'Scheduled Status', 'Scheduled Date',
            'Mode of Consultation', 'Handled By',
            'Consult Date', 'Consulted By', 'Consult Status', 'Process Status',
            'Action Taken', 'Rx Issued', 'Diagnosis', 'Treatment Plan', 'Detail Remarks',
            'Follow-up Type', 'Next Follow-up Interval', 'Follow-up Date',
            'Blood Test Required', 'Follow-up Reminder',
            'Final Remarks'
        ];

        var rows = [headers];

        for (var i = 0; i < allRecords.length; i++) {
            var r      = allRecords[i];
            var cust   = customerMap[r.customer_id] || {};
            var outlet = outletMap[r.outlet_id]     || {};
            var det    = getLatestDetail(r);
            var fu     = getLatestFollowUp(r);

            var handledByName = r.handled_by
                ? (staffMap[r.handled_by] ? staffMap[r.handled_by].name : String(r.handled_by))
                : '';

            var consultedByName = (det && det.consulted_by)
                ? (staffMap[det.consulted_by] ? staffMap[det.consulted_by].name : String(det.consulted_by))
                : '';

            var row = [
                '#CC' + r.id,
                r.customer_id || '',
                cust.name     || '',
                cust.ic       || '',
                cust.phone    || '',
                cust.gender   || '',
                cust.age      || '',
                outlet.code      || '',
                outlet.comp_name || '',
                formatDate(r.enrollment_date),
                LABELS.enrollment[String(r.enrollment_type)] || r.enrollment_type,
                LABELS.consent[String(r.consent_call_status)] !== undefined
                    ? LABELS.consent[String(r.consent_call_status)] : r.consent_call_status,
                formatDate(r.consent_call_date),
                (r.scheduled_status !== null && r.scheduled_status !== undefined)
                    ? (LABELS.scheduled[String(r.scheduled_status)] || r.scheduled_status) : '',
                formatDatetime(r.scheduled_call_date),
                (r.mode_of_consultation !== null && r.mode_of_consultation !== undefined)
                    ? (LABELS.modeConsult[String(r.mode_of_consultation)] || r.mode_of_consultation) : '',
                handledByName,
                det ? formatDate(det.consult_date) : '',
                consultedByName,
                det ? (LABELS.consultSt[String(det.consult_status)] || det.consult_status) : '',
                det ? (LABELS.process[String(det.process_status)] || det.process_status) : '',
                (det && det.action !== null && det.action !== undefined)
                    ? (LABELS.action[String(det.action)] || det.action) : '',
                det ? (det.rx_issued ? 'Yes' : 'No') : '',
                det ? (det.diagnosis     || '') : '',
                det ? (det.treatment_plan || '') : '',
                det ? (det.remarks       || '') : '',
                fu ? (LABELS.followupType[String(fu.followup_type)] || fu.followup_type) : '',
                fu ? (LABELS.nextFollowup[String(fu.next_followup)] || fu.next_followup) : '',
                fu ? formatDatetime(fu.followup_date) : '',
                fu ? (fu.is_blood_test_required ? 'Yes' : 'No') : '',
                fu ? (LABELS.reminder[String(fu.followup_reminder)] || fu.followup_reminder) : '',
                r.final_remarks || ''
            ];

            rows.push(row);
        }

        var csv = rows.map(function(row) {
            return row.map(function(cell) {
                var s = (cell === null || cell === undefined) ? '' : String(cell);
                if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
                    s = '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            }).join(',');
        }).join('\r\n');

        // UTF-8 BOM ensures Excel opens correctly without encoding issues
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href     = url;
        link.download = 'consult-call-report-' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ---------------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------------

    function resetFilters() {
        document.getElementById('dateFrom').value          = '';
        document.getElementById('dateTo').value            = '';
        document.getElementById('consentFilter').value     = '';
        document.getElementById('processFilter').value     = '';
        document.getElementById('enrollmentFilter').value  = '';
        document.getElementById('consultedByFilter').value = '';
        loadReport();
    }

    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('applyBtn').addEventListener('click', loadReport);
        document.getElementById('resetBtn').addEventListener('click', resetFilters);
        document.getElementById('exportBtn').addEventListener('click', exportCSV);
        loadReport();
    });

})();
