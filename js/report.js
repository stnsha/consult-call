/**
 * ConsultCall Dashboard - Report Page JavaScript
 * Fetches the full filtered consult-call dataset (same pattern as main.js's
 * exportToExcel) and aggregates it client-side into 11 Chart.js charts.
 *
 * Field reference used for aggregation (see js/main.js and js/edit.js for the
 * authoritative vocab this mirrors):
 *   consent_call_status: 0=Pending, 1=Obtained, 2=Refused, 3=Not Eligible (aka "Others")
 *   reason: free text matching REASON_PREDEFINED, only meaningful when
 *     consent_call_status is 2 or 3
 *   enrollment_type: 1=New Case (Primary), 2=Follow-up
 *   add_on_id / add_on.name: single FK per consult call, no array/junction
 *   Detail: consultation_type (1=New Case, 2=Follow-Up), consult_status (0=Pending,
 *     1=Completed, 2=No Show, 3=Cancelled), action (1=Refer Internal, 2=Refer
 *     External, 3=End Process), consulted_by, is_draft, process_status
 */
(function() {
    'use strict';

    // Validated default categorical palette (see dataviz skill references/palette.md).
    // Slot 1 (blue) is the single "count of cases" hue used consistently across every
    // single-series chart on this dashboard; slot 2 (orange) is reserved for the one
    // two-series chart (B5) so New Case vs Follow-up reads as a fixed, distinct pair.
    var COLOR_PRIMARY   = '#2a78d6';
    var COLOR_SECONDARY = '#eb6834';
    var COLOR_GRID      = '#e1e0d9';
    var COLOR_TICK      = '#898781';
    var COLOR_TEXT      = '#52514e';

    // Fixed-order categorical palette (blue, orange, aqua, yellow, magenta, green,
    // violet, red) -- validated for adjacent-pair CVD separation on bars/stacks.
    // Assigned by bar index, cycling if a chart has more bars than slots.
    var CATEGORICAL_PALETTE = [
        '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
        '#e87ba4', '#008300', '#4a3aa7', '#e34948'
    ];

    function paletteColors(count) {
        var colors = [];
        for (var i = 0; i < count; i++) {
            colors.push(CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]);
        }
        return colors;
    }

    var REASON_CODE_MAP = {
        'On Prescribed Medication/Follow-Up': 'OM-FU',
        'Unreachable': 'UR',
        'Not Keen': 'NK',
        'Foreign Number': 'FN'
    };

    var chartInstances = {};
    var state = { records: [] };

    if (window.Chart) {
        Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";
        Chart.defaults.color = COLOR_TEXT;
        Chart.defaults.borderColor = COLOR_GRID;
    }

    /**
     * Make an API call to the consult call backend (same contract as main.js's apiCall)
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

    function getFilterParams() {
        return {
            date_from: document.getElementById('rptDateFrom').value,
            date_to: document.getElementById('rptDateTo').value,
            outlet_id: document.getElementById('rptOutletFilter').value,
            consulted_by: document.getElementById('rptDoctorFilter').value
        };
    }

    function getPeriod() {
        return document.getElementById('rptPeriodToggle').value;
    }

    /**
     * Fetch the full filtered consult-call dataset in one page, mirroring
     * main.js exportToExcel()'s per_page:10000 pattern. outlet_id is not part
     * of all-consult-call's server-side filter whitelist, so it is applied
     * client-side afterward.
     * @param {object} filters From getFilterParams()
     * @returns {Promise}
     */
    function fetchDataset(filters) {
        var params = {};
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        if (filters.consulted_by) params.consulted_by = filters.consulted_by;
        params.per_page = 10000;
        params.page = 1;
        return apiCall('all-consult-call', params);
    }

    function getLatestDetail(record) {
        var details = record.details || [];
        return details.length > 0 ? details[details.length - 1] : null;
    }

    /**
     * Latest consultation detail, excluding drafts -- a draft has not been
     * finalised so its action/consult_status/consultation_type should not be
     * counted (mirrors js/main.js renderRow()'s detailIsDraft handling).
     * @param {object} record Consult call record
     * @returns {object|null}
     */
    function getLatestNonDraftDetail(record) {
        var latest = getLatestDetail(record);
        if (latest && latest.is_draft === 1) return null;
        return latest;
    }

    /**
     * Derive process status the same way js/main.js renderRow() does.
     * @param {object} record Consult call record
     * @returns {number|null} 1=Active, 3=Closed, or null if undetermined
     */
    function deriveProcessStatus(record) {
        var latestDetail = getLatestDetail(record);
        var detailIsDraft = !!(latestDetail && latestDetail.is_draft === 1);

        if (record.process_status != null) {
            return parseInt(record.process_status, 10);
        }
        if (!detailIsDraft && latestDetail && latestDetail.process_status != null) {
            return parseInt(latestDetail.process_status, 10);
        }
        var cs = parseInt(record.consent_call_status, 10);
        var act = (!detailIsDraft && latestDetail) ? parseInt(latestDetail.action, 10) : null;
        var cst = (!detailIsDraft && latestDetail) ? parseInt(latestDetail.consult_status, 10) : null;
        if (cs === 2 || cs === 3) return 3;
        if (act === 2 || act === 3 || cst === 2) return 3;
        if (!detailIsDraft && latestDetail) return 1;
        return null;
    }

    /**
     * Resolve outlet_id/consulted_by references on the dataset to display names,
     * batched the same way main.js exportToExcel() does for customers/outlets.
     * @param {Array} records Consult call records
     * @returns {Promise} Resolves with { outletMap, staffMap }
     */
    function resolveNames(records) {
        var outletIds = [];
        var staffIds = [];
        var seenOutlets = {};
        var seenStaff = {};

        for (var i = 0; i < records.length; i++) {
            var oid = records[i].outlet_id;
            if (oid && !seenOutlets[oid]) {
                outletIds.push(oid);
                seenOutlets[oid] = true;
            }
            var det = getLatestNonDraftDetail(records[i]);
            var sid = det && det.consulted_by ? det.consulted_by : null;
            if (sid && !seenStaff[sid]) {
                staffIds.push(sid);
                seenStaff[sid] = true;
            }
        }

        var outletPromise = outletIds.length > 0
            ? apiCall('get-outlets', { outlet_ids: outletIds })
            : Promise.resolve({ success: true, data: {} });
        var staffPromise = staffIds.length > 0
            ? apiCall('get-staff', { staff_ids: staffIds })
            : Promise.resolve({ success: true, data: {} });

        return Promise.all([outletPromise, staffPromise]).then(function(results) {
            return {
                outletMap: (results[0].success && results[0].data) ? results[0].data : {},
                staffMap: (results[1].success && results[1].data) ? results[1].data : {}
            };
        });
    }

    // ---- Date/period bucketing helpers (A1) ----

    function pad2(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    function parseDateOnly(str) {
        if (!str) return null;
        var m = String(str).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) {
            var d = new Date(str);
            return isNaN(d.getTime()) ? null : d;
        }
        return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    }

    function isoWeekKey(d) {
        var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        var dayNum = date.getUTCDay() || 7;
        date.setUTCDate(date.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        var weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        return date.getUTCFullYear() + '-W' + pad2(weekNo);
    }

    function bucketKey(d, period) {
        if (period === 'day') return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
        if (period === 'week') return isoWeekKey(d);
        if (period === 'year') return '' + d.getFullYear();
        return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    }

    // ---- Aggregation functions: records -> {labels, data} (or {labels, datasets}) ----

    function aggregateEnrollmentOverTime(records, period) {
        var counts = {};
        for (var i = 0; i < records.length; i++) {
            var d = parseDateOnly(records[i].enrollment_date);
            if (!d) continue;
            var key = bucketKey(d, period);
            counts[key] = (counts[key] || 0) + 1;
        }
        var keys = Object.keys(counts).sort();
        return {
            labels: keys,
            data: keys.map(function(k) { return counts[k]; })
        };
    }

    function aggregateEnrollmentType(records) {
        var counts = { nc: 0, fu: 0 };
        for (var i = 0; i < records.length; i++) {
            var t = parseInt(records[i].enrollment_type, 10);
            if (t === 1) counts.nc++;
            else if (t === 2) counts.fu++;
        }
        return { labels: ['New Case', 'Follow-up'], data: [counts.nc, counts.fu] };
    }

    function aggregateByOutlet(records, outletMap) {
        var counts = {};
        for (var i = 0; i < records.length; i++) {
            var oid = records[i].outlet_id;
            if (!oid) continue;
            counts[oid] = (counts[oid] || 0) + 1;
        }
        var ids = Object.keys(counts);
        ids.sort(function(a, b) { return counts[b] - counts[a]; });
        ids = ids.slice(0, 10);
        var labels = ids.map(function(id) {
            var o = outletMap[id];
            return o ? o.code : ('Outlet #' + id);
        });
        return { labels: labels, data: ids.map(function(id) { return counts[id]; }) };
    }

    function aggregateByDoctor(records, staffMap) {
        var counts = {};
        for (var i = 0; i < records.length; i++) {
            var det = getLatestNonDraftDetail(records[i]);
            var sid = det && det.consulted_by ? det.consulted_by : null;
            if (!sid) continue;
            counts[sid] = (counts[sid] || 0) + 1;
        }
        var ids = Object.keys(counts);
        ids.sort(function(a, b) { return counts[b] - counts[a]; });
        var labels = ids.map(function(id) {
            var s = staffMap[id];
            return s ? s.name : ('Staff #' + id);
        });
        return { labels: labels, data: ids.map(function(id) { return counts[id]; }) };
    }

    function aggregateConsentStatus(records) {
        var counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
        for (var i = 0; i < records.length; i++) {
            var cs = parseInt(records[i].consent_call_status, 10);
            if (counts.hasOwnProperty(cs)) counts[cs]++;
        }
        return {
            labels: ['Pending', 'Obtained', 'Refused', 'Not Eligible'],
            data: [counts[0], counts[1], counts[2], counts[3]]
        };
    }

    function aggregateNonEligibilityReasons(records) {
        var counts = { 'OM-FU': 0, 'UR': 0, 'NK': 0, 'FN': 0, 'Other': 0 };
        for (var i = 0; i < records.length; i++) {
            var cs = parseInt(records[i].consent_call_status, 10);
            if (cs !== 2 && cs !== 3) continue;
            var reason = records[i].reason;
            var code = (reason && REASON_CODE_MAP.hasOwnProperty(reason)) ? REASON_CODE_MAP[reason] : 'Other';
            counts[code]++;
        }
        return {
            labels: ['On Prescribed Medication/Follow-Up', 'Unreachable', 'Not Keen', 'Foreign Number', 'Other'],
            data: [counts['OM-FU'], counts.UR, counts.NK, counts.FN, counts.Other]
        };
    }

    function aggregateAddOnStatus(records) {
        var yes = 0, no = 0;
        for (var i = 0; i < records.length; i++) {
            if (records[i].add_on_id) yes++;
            else no++;
        }
        return { labels: ['Yes', 'No'], data: [yes, no] };
    }

    function aggregateTestsAdded(records) {
        var counts = {};
        for (var i = 0; i < records.length; i++) {
            if (!records[i].add_on_id) continue;
            var name = (records[i].add_on && records[i].add_on.name) ? records[i].add_on.name : 'Unnamed';
            counts[name] = (counts[name] || 0) + 1;
        }
        var names = Object.keys(counts);
        names.sort(function(a, b) { return counts[b] - counts[a]; });
        return { labels: names, data: names.map(function(n) { return counts[n]; }) };
    }

    function aggregateConsultationStatusByType(records) {
        var nc = [0, 0, 0];
        var fu = [0, 0, 0];
        for (var i = 0; i < records.length; i++) {
            var det = getLatestNonDraftDetail(records[i]);
            if (!det) continue;
            var type = parseInt(det.consultation_type, 10);
            var status = parseInt(det.consult_status, 10);
            if (status < 1 || status > 3) continue; // skip Pending
            var idx = status - 1;
            if (type === 1) nc[idx]++;
            else if (type === 2) fu[idx]++;
        }
        return {
            labels: ['Completed', 'No Show', 'Cancelled'],
            datasets: [
                { label: 'New Case', data: nc },
                { label: 'Follow-up', data: fu }
            ]
        };
    }

    function aggregateProcessStatus(records) {
        var active = 0, closed = 0;
        for (var i = 0; i < records.length; i++) {
            var p = deriveProcessStatus(records[i]);
            if (p === 1) active++;
            else if (p === 3) closed++;
        }
        return { labels: ['Active', 'Closed'], data: [active, closed] };
    }

    function aggregateModeOfAction(records) {
        var counts = { 1: 0, 2: 0, 3: 0 };
        for (var i = 0; i < records.length; i++) {
            var det = getLatestNonDraftDetail(records[i]);
            if (!det) continue;
            var a = parseInt(det.action, 10);
            if (counts.hasOwnProperty(a)) counts[a]++;
        }
        return {
            labels: ['Refer Internal', 'Refer External', 'End Process'],
            data: [counts[1], counts[2], counts[3]]
        };
    }

    // ---- Chart.js rendering ----

    function baseScales(horizontal) {
        var valueAxis = { beginAtZero: true, ticks: { precision: 0, color: COLOR_TICK }, grid: { color: COLOR_GRID } };
        var labelAxis = { ticks: { color: COLOR_TICK }, grid: { display: false } };
        return horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis };
    }

    function drawChart(canvasId, config) {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        var el = document.getElementById(canvasId);
        if (!el) return;
        chartInstances[canvasId] = new Chart(el, config);
    }

    function renderBarChart(canvasId, agg, opts) {
        opts = opts || {};
        var horizontal = !!opts.horizontal;
        drawChart(canvasId, {
            type: 'bar',
            data: {
                labels: agg.labels,
                datasets: [{
                    data: agg.data,
                    backgroundColor: paletteColors(agg.data.length),
                    borderRadius: 4,
                    borderSkipped: false,
                    categoryPercentage: 0.6,
                    barPercentage: 0.85
                }]
            },
            options: {
                indexAxis: horizontal ? 'y' : 'x',
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: baseScales(horizontal)
            }
        });
    }

    function renderLineChart(canvasId, agg) {
        drawChart(canvasId, {
            type: 'line',
            data: {
                labels: agg.labels,
                datasets: [{
                    data: agg.data,
                    borderColor: COLOR_PRIMARY,
                    backgroundColor: 'rgba(42, 120, 214, 0.12)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                    pointBackgroundColor: COLOR_PRIMARY
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: baseScales(false)
            }
        });
    }

    function renderGroupedBarChart(canvasId, agg) {
        var colors = [COLOR_PRIMARY, COLOR_SECONDARY];
        var datasets = agg.datasets.map(function(ds, i) {
            return {
                label: ds.label,
                data: ds.data,
                backgroundColor: colors[i],
                borderRadius: 4,
                borderSkipped: false,
                categoryPercentage: 0.6,
                barPercentage: 0.85
            };
        });
        drawChart(canvasId, {
            type: 'bar',
            data: { labels: agg.labels, datasets: datasets },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, color: COLOR_TEXT } } },
                scales: baseScales(false)
            }
        });
    }

    function renderChartA1(records, period) {
        renderLineChart('chartA1', aggregateEnrollmentOverTime(records, period));
    }

    function renderAllCharts(records, outletMap, staffMap) {
        renderChartA1(records, getPeriod());
        renderBarChart('chartA2', aggregateEnrollmentType(records));
        renderBarChart('chartA3', aggregateByOutlet(records, outletMap), { horizontal: true });
        renderBarChart('chartA4', aggregateByDoctor(records, staffMap), { horizontal: true });

        renderBarChart('chartB1', aggregateConsentStatus(records));
        renderBarChart('chartB2', aggregateNonEligibilityReasons(records), { horizontal: true });
        renderBarChart('chartB3', aggregateAddOnStatus(records));
        renderBarChart('chartB4', aggregateTestsAdded(records), { horizontal: true });
        renderGroupedBarChart('chartB5', aggregateConsultationStatusByType(records));
        renderBarChart('chartB6', aggregateProcessStatus(records));
        renderBarChart('chartB7', aggregateModeOfAction(records));
    }

    // ---- Load flow ----

    function setLoadingState(isLoading) {
        var btn = document.getElementById('rptApplyBtn');
        if (!btn) return;
        btn.disabled = isLoading;
        btn.innerHTML = isLoading
            ? '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>'
            : '<i class="bi bi-funnel me-1"></i>Apply';
    }

    function loadReport() {
        setLoadingState(true);
        var filters = getFilterParams();

        fetchDataset(filters).then(function(result) {
            if (!result || !result.success || !result.data) {
                setLoadingState(false);
                return;
            }
            var records = result.data.data || [];
            if (filters.outlet_id) {
                records = records.filter(function(r) {
                    return String(r.outlet_id) === String(filters.outlet_id);
                });
            }
            state.records = records;

            resolveNames(records).then(function(maps) {
                renderAllCharts(records, maps.outletMap, maps.staffMap);
                setLoadingState(false);
            });
        })['catch'](function() {
            setLoadingState(false);
        });
    }

    function resetFilters() {
        var now = new Date();
        var monthStart = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-01';
        var today = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
        document.getElementById('rptDateFrom').value = monthStart;
        document.getElementById('rptDateTo').value = today;
        document.getElementById('rptOutletFilter').value = '';
        document.getElementById('rptDoctorFilter').value = '';
        document.getElementById('rptPeriodToggle').value = 'month';
        loadReport();
    }

    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('rptApplyBtn').addEventListener('click', loadReport);
        document.getElementById('rptResetBtn').addEventListener('click', resetFilters);
        document.getElementById('rptPeriodToggle').addEventListener('change', function() {
            renderChartA1(state.records, getPeriod());
        });

        loadReport();
    });
})();
