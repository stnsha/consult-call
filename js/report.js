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
 *   add_on_ids / addOns[].add_on.name: multiple add-ons per consult call
 *     via the consult_call_add_ons pivot (backend accessor + eager-loaded relation)
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
    var state = { records: [], filters: {} };

    if (window.Chart) {
        Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";
        Chart.defaults.color = COLOR_TEXT;
        Chart.defaults.borderColor = COLOR_GRID;
        if (window.ChartDataLabels) {
            Chart.register(ChartDataLabels);
        }
    }

    // Shared value-label formatter -- hides zero-value labels to reduce clutter,
    // otherwise prints the raw count above/beside each bar, point, or segment.
    function valueLabelFormatter(value) {
        return value === 0 ? '' : value;
    }

    var DATALABEL_STYLE = {
        color: COLOR_TEXT,
        font: { size: 11, weight: '600' },
        formatter: valueLabelFormatter,
        // Keeps the label inside the chart's drawing area instead of letting it get
        // clipped off the top edge when a bar/point sits at or near the axis max.
        clamp: true
    };

    // ES5-safe stand-in for Object.assign({}, DATALABEL_STYLE, extra) -- shallow merge only.
    function extendDatalabelStyle(extra) {
        var merged = {};
        for (var k in DATALABEL_STYLE) {
            if (DATALABEL_STYLE.hasOwnProperty(k)) merged[k] = DATALABEL_STYLE[k];
        }
        for (var k2 in extra) {
            if (extra.hasOwnProperty(k2)) merged[k2] = extra[k2];
        }
        return merged;
    }

    // ---- Percentage of total consult calls (every chart shows this alongside its raw count) ----

    /**
     * Each value's share of totalRecords (the full filtered consult-call count),
     * as a percentage. Not the sum of this chart's own bars -- the same
     * totalRecords denominator is used across every chart so the numbers are
     * directly comparable. Charts whose categories don't cover every record
     * (e.g. Top 10 Outlets, Non-Eligibility Reasons) will legitimately not sum
     * to 100% -- that's correct, not a bug.
     * @param {number[]} data
     * @param {number} totalRecords Total consult calls in the current filtered dataset
     * @returns {number[]}
     */
    function computePercentOfTotal(data, totalRecords) {
        return data.map(function(v) {
            return totalRecords > 0 ? (v / totalRecords) * 100 : 0;
        });
    }

    function formatPercentOfTotal(pct) {
        var rounded = Math.round(pct * 10) / 10;
        return rounded === 0 ? '' : rounded + '%';
    }

    /**
     * Full datalabels config for a single-series dataset: the existing raw-count
     * label plus a second, offset label showing that bar's % of total consult calls.
     * @param {number[]} data Raw values for this dataset, in display order
     * @param {boolean} horizontal Whether the chart uses a horizontal (indexAxis 'y') layout
     * @param {number} totalRecords Total consult calls in the current filtered dataset
     * @returns {object} plugins.datalabels config with `labels.value` and `labels.percent`
     */
    var COLOR_PERCENT = '#e34948'; // red, distinct from the count label's neutral text color

    function valueAndPercentDatalabels(data, horizontal, totalRecords) {
        var percents = computePercentOfTotal(data, totalRecords);
        var alignDir = horizontal ? 'right' : 'top';

        // Horizontal bars keep count + percent side by side on the same row, separated by
        // a gap sized to that specific count's own digit width (a fixed gap either wasted
        // space on short numbers like "31" or wasn't enough to clear wide ones like "4190",
        // which is what caused the overlap). ~7px/digit at this font size, plus a fixed
        // padding gap so there's always visible whitespace between the two labels.
        function percentOffset(ctx) {
            if (!horizontal) return 14;
            var digits = String(valueLabelFormatter(data[ctx.dataIndex])).length;
            return 10 + digits * 7;
        }

        return {
            labels: {
                value: extendDatalabelStyle({ anchor: 'end', align: alignDir }),
                percent: {
                    color: COLOR_PERCENT,
                    font: { size: 10, weight: '600', style: 'italic' },
                    anchor: 'end',
                    align: alignDir,
                    offset: percentOffset,
                    clamp: true,
                    formatter: function(value, ctx) { return formatPercentOfTotal(percents[ctx.dataIndex]); }
                }
            }
        };
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

    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    // ---- Date/period bucketing helpers (A1) ----

    function pad2(n) {
        return n < 10 ? '0' + n : '' + n;
    }

    // en-CA formats as YYYY-MM-DD.
    var KL_DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit'
    });

    function parseDateOnly(str) {
        if (!str) return null;
        // Laravel serializes datetime casts in UTC (e.g. 2026-08-31T16:45:39.000000Z
        // for 1 Sep 00:45 Malaysia time). Convert those to the Asia/Kuala_Lumpur
        // calendar date -- independent of the viewer's browser timezone -- instead
        // of reading the UTC date off the string.
        if (/T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(String(str))) {
            var utc = new Date(str);
            if (!isNaN(utc.getTime())) {
                var klParts = KL_DATE_FORMAT.format(utc).split('-');
                return new Date(parseInt(klParts[0], 10), parseInt(klParts[1], 10) - 1, parseInt(klParts[2], 10));
            }
        }
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

    var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Displays a sortable bucket key ("2026-08") as a human month label ("Aug 2026")
    // when the trend is grouped by month; other periods keep their raw key as-is.
    function formatBucketLabel(key, period) {
        if (period !== 'month') return key;
        var m = key.match(/^(\d{4})-(\d{2})$/);
        if (!m) return key;
        return MONTH_ABBR[parseInt(m[2], 10) - 1] + ' ' + m[1];
    }

    // ---- Aggregation functions: records -> {labels, data} (or {labels, datasets}) ----
    //
    // Every chart below (except A1, already a month trend) is x-axis = month, with the
    // chart's original categories (Yes/No, Pending/Obtained/..., etc.) as grouped bars
    // within each month -- e.g. Add-On Status becomes "Aug: [Yes bar, No bar], Sep: [Yes
    // bar, No bar], ...". All bucket by enrollment_date for one consistent time axis
    // across the whole dashboard (same field the Enrollment From/To filter itself uses).

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
            keys: keys,
            labels: keys.map(function(k) { return formatBucketLabel(k, period); }),
            data: keys.map(function(k) { return counts[k]; })
        };
    }

    /**
     * Generic month x category grouped aggregator. Buckets each record into a month
     * (via enrollment_date) and a category index (via categorize()), producing one
     * dataset per category label -- the shape renderGroupedBarChart() expects.
     * @param {Array} records Consult call records
     * @param {function(object): (number|null)} categorize Returns a 0-based index into
     *   categoryLabels for this record, or null/undefined to exclude it entirely
     * @param {string[]} categoryLabels Fixed, ordered category names (small sets only --
     *   this renders one grouped bar per label per month)
     * @param {object[]} [categoryFilters] index.php query params per category, used by
     *   the chart click drill-down (same order as categoryLabels)
     * @returns {{keys: string[], months: string[], datasets: {label: string, data: number[], filter: object}[]}}
     */
    function aggregateGroupedByMonth(records, categorize, categoryLabels, categoryFilters) {
        var byMonth = {};
        for (var i = 0; i < records.length; i++) {
            var d = parseDateOnly(records[i].enrollment_date);
            if (!d) continue;
            var idx = categorize(records[i]);
            if (idx === null || idx === undefined) continue;
            var key = bucketKey(d, 'month');
            if (!byMonth[key]) {
                byMonth[key] = [];
                for (var z = 0; z < categoryLabels.length; z++) byMonth[key].push(0);
            }
            byMonth[key][idx]++;
        }
        var keys = Object.keys(byMonth).sort();
        return {
            keys: keys,
            months: keys.map(function(k) { return formatBucketLabel(k, 'month'); }),
            datasets: categoryLabels.map(function(label, idx) {
                return {
                    label: label,
                    data: keys.map(function(k) { return byMonth[k][idx]; }),
                    filter: (categoryFilters && categoryFilters[idx]) || {}
                };
            })
        };
    }

    /**
     * Same month bucketing as aggregateGroupedByMonth(), but for high-cardinality
     * breakdowns (outlets, doctors) where one grouped bar per category per month would
     * be unreadable clutter. Ranks categories by their total count across the whole
     * filtered range, keeps the top N as their own segments, and folds everything else
     * into a single "Others" segment -- meant to be rendered as a stacked bar per month.
     * @param {Array} records Consult call records
     * @param {function(object): (string|number|null)} idGetter Category id for this
     *   record (e.g. outlet_id), or null/undefined to exclude it
     * @param {function(string|number): string} nameGetter Display name for a category id
     * @param {number} topN How many top categories get their own segment
     * @param {boolean} includeOthers Fold the rest into an "Others" segment
     * @param {function(string|number): object} [filterForId] index.php query params
     *   for a category id, used by the chart click drill-down
     * @returns {{keys: string[], months: string[], datasets: {label: string, data: number[], filter: object}[]}}
     */
    function aggregateStackedByMonth(records, idGetter, nameGetter, topN, includeOthers, filterForId) {
        var totalCounts = {};
        for (var i = 0; i < records.length; i++) {
            var id = idGetter(records[i]);
            if (id === null || id === undefined) continue;
            totalCounts[id] = (totalCounts[id] || 0) + 1;
        }
        var ids = Object.keys(totalCounts);
        ids.sort(function(a, b) { return totalCounts[b] - totalCounts[a]; });
        var topIds = ids.slice(0, topN);
        var topIndex = {};
        for (var t = 0; t < topIds.length; t++) topIndex[topIds[t]] = t;
        // When includeOthers is false, records outside the top N are dropped entirely
        // rather than folded into an "Others" segment.
        var hasOthers = !!includeOthers && ids.length > topN;

        var labels = topIds.map(nameGetter);
        if (hasOthers) labels.push('Others');

        var byMonth = {};
        for (var j = 0; j < records.length; j++) {
            var d = parseDateOnly(records[j].enrollment_date);
            if (!d) continue;
            var rid = idGetter(records[j]);
            if (rid === null || rid === undefined) continue;
            var idx = topIndex.hasOwnProperty(rid) ? topIndex[rid] : (hasOthers ? labels.length - 1 : -1);
            if (idx < 0) continue;
            var key = bucketKey(d, 'month');
            if (!byMonth[key]) {
                byMonth[key] = [];
                for (var z = 0; z < labels.length; z++) byMonth[key].push(0);
            }
            byMonth[key][idx]++;
        }
        var keys = Object.keys(byMonth).sort();
        return {
            keys: keys,
            months: keys.map(function(k) { return formatBucketLabel(k, 'month'); }),
            datasets: labels.map(function(label, idx) {
                // "Others" has no single id to filter on -- it stays non-clickable.
                var id = idx < topIds.length ? topIds[idx] : null;
                return {
                    label: label,
                    data: keys.map(function(k) { return byMonth[k][idx]; }),
                    filter: (id !== null && filterForId) ? filterForId(id) : null
                };
            })
        };
    }

    function aggregateByOutletMonthly(records, outletMap) {
        // Top 5 outlets only -- records outside the top 5 are dropped, no "Others" bucket.
        var outletName = function(id) { var o = outletMap[id]; return o ? o.code : ('Outlet #' + id); };
        return aggregateStackedByMonth(records,
            function(r) { return r.outlet_id || null; },
            outletName,
            5, false,
            function(id) { return { outlet_id: id, outlet_code: outletName(id) }; });
    }

    function aggregateByDoctorMonthly(records, staffMap) {
        // Top 5 doctors only -- records outside the top 5 are dropped, no "Others" bucket.
        return aggregateStackedByMonth(records,
            function(r) {
                var det = getLatestNonDraftDetail(r);
                return (det && det.consulted_by) ? det.consulted_by : null;
            },
            function(id) { var s = staffMap[id]; return s ? s.name : ('Staff #' + id); },
            5, false,
            function(id) { return { consulted_by: id }; });
    }

    // Answered Call (consult_calls.call_answered: 1 = Yes, 0 = No, 2 = None / no call
    // made) per month. Records where it was never recorded (null, e.g. still Pending)
    // are left out.
    function aggregateAnsweredCall(records) {
        var order = [1, 0, 2];
        return aggregateGroupedByMonth(records, function(r) {
            if (r.call_answered === null || r.call_answered === undefined) return null;
            var idx = order.indexOf(parseInt(r.call_answered, 10));
            return idx >= 0 ? idx : null;
        }, ['Yes', 'No', 'None'], order.map(function(v) { return { call_answered: v }; }));
    }

    function aggregateConsentStatus(records) {
        return aggregateGroupedByMonth(records, function(r) {
            var cs = parseInt(r.consent_call_status, 10);
            return (cs >= 0 && cs <= 3) ? cs : null;
        }, ['Pending', 'Obtained', 'Refused', 'Not Eligible'], [
            { consent_call_status: 0 }, { consent_call_status: 1 },
            { consent_call_status: 2 }, { consent_call_status: 3 }
        ]);
    }

    function aggregateNonEligibilityReasons(records) {
        var order = ['OM-FU', 'UR', 'NK', 'FN', 'Other'];
        return aggregateGroupedByMonth(records, function(r) {
            var cs = parseInt(r.consent_call_status, 10);
            if (cs !== 2 && cs !== 3) return null;
            var code = (r.reason && REASON_CODE_MAP.hasOwnProperty(r.reason)) ? REASON_CODE_MAP[r.reason] : 'Other';
            return order.indexOf(code);
        }, ['On Prescribed Medication/Follow-Up', 'Unreachable', 'Not Keen', 'Foreign Number', 'Other'],
        order.map(function(code) { return { non_eligibility_reason: code.toUpperCase() }; }));
    }

    function aggregateAddOnStatus(records) {
        return aggregateGroupedByMonth(records, function(r) {
            return (r.add_on_ids && r.add_on_ids.length) ? 0 : 1;
        }, ['Yes', 'No'], [{ has_add_on: 1 }, { has_add_on: 0 }]);
    }

    /**
     * Advise Type breakdown (CC / AO / CC + AO) per month, read off the latest non-draft
     * detail's linked clinical condition -- same field/values as the Advise Type badge
     * shown on index.php's table and edit.php's consultation history. Records with no
     * clinical condition attached yet are excluded rather than bucketed as "Unknown".
     * @param {Array} records Consult call records
     * @returns {{months: string[], datasets: {label: string, data: number[]}[]}}
     */
    function aggregateAdviseTypeBreakdown(records) {
        var order = ['CC', 'AO', 'CC + AO'];
        return aggregateGroupedByMonth(records, function(r) {
            var det = getLatestNonDraftDetail(r);
            var type = det && det.clinical_condition ? det.clinical_condition.type : null;
            return type ? order.indexOf(type) : null;
        }, order.slice(), order.map(function(type) { return { advise_type: type }; }));
    }

    // Simplified to New Case vs Follow-up per month -- the original consult_status
    // (Completed/No Show/Cancelled) breakdown doesn't fit a third (month) axis without
    // needing 6 bars per month, so it's dropped in favor of the month view.
    function aggregateConsultationStatusByType(records) {
        return aggregateGroupedByMonth(records, function(r) {
            var det = getLatestNonDraftDetail(r);
            if (!det) return null;
            var status = parseInt(det.consult_status, 10);
            if (status < 1 || status > 3) return null; // skip Pending
            var type = parseInt(det.consultation_type, 10);
            return type === 1 ? 0 : (type === 2 ? 1 : null);
        }, ['New Case', 'Follow-up'], [
            { consultation_type: 1, consult_status_in: '1,2,3' },
            { consultation_type: 2, consult_status_in: '1,2,3' }
        ]);
    }

    function aggregateProcessStatus(records) {
        return aggregateGroupedByMonth(records, function(r) {
            var p = deriveProcessStatus(r);
            return p === 1 ? 0 : (p === 3 ? 1 : null);
        }, ['Active', 'Closed'], [{ process_status: 1 }, { process_status: 3 }]);
    }

    function aggregateModeOfAction(records) {
        return aggregateGroupedByMonth(records, function(r) {
            var det = getLatestNonDraftDetail(r);
            if (!det) return null;
            var a = parseInt(det.action, 10);
            return a === 1 ? 0 : (a === 2 ? 1 : (a === 3 ? 2 : null));
        }, ['Refer Internal', 'Refer External', 'End Process'],
        [{ detail_action: 1 }, { detail_action: 2 }, { detail_action: 3 }]);
    }

    /**
     * Consult calls per recommended add-on across the whole filtered dataset (a
     * consult call with several add-ons counts once under each), most used first.
     * @param {Array} records Consult call records (with add_ons[].add_on loaded)
     * @returns {{ids: number[], labels: string[], data: number[]}}
     */
    function aggregateAddOnUsage(records) {
        var counts = {};
        var names = {};
        for (var i = 0; i < records.length; i++) {
            var addOns = records[i].add_ons || [];
            var seen = {};
            for (var j = 0; j < addOns.length; j++) {
                var id = addOns[j].add_on_id;
                if (!id || seen[id]) continue;
                seen[id] = true;
                counts[id] = (counts[id] || 0) + 1;
                if (addOns[j].add_on && addOns[j].add_on.name) names[id] = addOns[j].add_on.name;
            }
        }
        var ids = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; });
        return {
            ids: ids,
            labels: ids.map(function(id) { return names[id] || ('Add On #' + id); }),
            data: ids.map(function(id) { return counts[id]; })
        };
    }

    /**
     * Horizontal bar chart of consult calls per add-on. Clicking a bar opens
     * index.php for the report's full enrollment range, doctor/outlet, and that add-on.
     */
    function renderAddOnUsageChart(records) {
        var agg = aggregateAddOnUsage(records);
        var wrap = document.getElementById('chartAddOnUsageWrap');
        var emptyEl = document.getElementById('chartAddOnUsageEmpty');

        if (agg.ids.length === 0) {
            if (chartInstances.chartAddOnUsage) {
                chartInstances.chartAddOnUsage.destroy();
                delete chartInstances.chartAddOnUsage;
            }
            if (wrap) wrap.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        if (emptyEl) emptyEl.style.display = 'none';
        if (wrap) {
            wrap.style.display = 'block';
            // One row per add-on so long lists stay readable.
            wrap.style.height = Math.max(160, agg.ids.length * 36 + 40) + 'px';
        }

        var filters = state.filters || {};
        drawChart('chartAddOnUsage', {
            type: 'bar',
            data: {
                labels: agg.labels,
                datasets: [{
                    data: agg.data,
                    backgroundColor: COLOR_PRIMARY,
                    borderRadius: 4,
                    barPercentage: 0.8,
                    datalabels: valueAndPercentDatalabels(agg.data, true, records.length)
                }]
            },
            options: {
                indexAxis: 'y',
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: baseScales(true),
                onClick: function(evt, elements, chart) {
                    var hits = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                    if (!hits.length) return;
                    var idx = hits[0].index;
                    window.location.href = buildListUrl(
                        { add_on_id: agg.ids[idx], add_on_name: agg.labels[idx] },
                        filters.date_from || '', filters.date_to || ''
                    );
                },
                onHover: function(evt, elements, chart) {
                    var hits = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
                    chart.canvas.style.cursor = hits.length ? 'pointer' : 'default';
                }
            }
        });
    }

    // ---- Chart.js rendering ----

    function baseScales(horizontal) {
        // grace pads the axis max beyond the highest bar/point so Chart.js's nice-number
        // tick generator adds one more tick sequence above it -- otherwise a bar sitting
        // exactly at the top tick leaves the count + %-of-total labels with nowhere to
        // render and they clip. Horizontal charts need more since those two labels stack
        // out past the bar end (offset 16px) rather than just above it.
        var valueAxis = {
            beginAtZero: true,
            grace: horizontal ? '25%' : '40%',
            ticks: { precision: 0, color: COLOR_TICK },
            grid: { color: COLOR_GRID }
        };
        var labelAxis = { ticks: { color: COLOR_TICK }, grid: { display: false } };
        return horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis };
    }

    /**
     * Make a month-axis chart clickable: clicking a bar/point opens index.php with
     * that month's enrollment range (clipped to the report's range), the report's
     * doctor/outlet filters, and the clicked dataset's own filter.
     * @param {object} options Chart.js options object to extend
     * @param {{keys: string[], datasets?: {filter: object}[]}} agg Aggregation result
     */
    function enableDrilldown(options, agg) {
        function hitElement(evt, chart) {
            var hits = chart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
            if (!hits.length) return null;
            var hit = hits[0];
            var filter = agg.datasets ? agg.datasets[hit.datasetIndex].filter : {};
            if (!filter || !agg.keys[hit.index]) return null;
            return { filter: filter, monthKey: agg.keys[hit.index] };
        }

        options.onClick = function(evt, elements, chart) {
            var target = hitElement(evt, chart);
            if (!target) return;
            var range = clippedMonthRange(target.monthKey);
            window.location.href = buildListUrl(target.filter, range.from, range.to);
        };
        options.onHover = function(evt, elements, chart) {
            chart.canvas.style.cursor = hitElement(evt, chart) ? 'pointer' : 'default';
        };
    }

    function drawChart(canvasId, config) {
        if (chartInstances[canvasId]) {
            chartInstances[canvasId].destroy();
        }
        var el = document.getElementById(canvasId);
        if (!el) return;
        chartInstances[canvasId] = new Chart(el, config);
    }

    function renderLineChart(canvasId, agg, total) {
        var config = {
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
                plugins: {
                    legend: { display: false },
                    datalabels: valueAndPercentDatalabels(agg.data, false, total || 0)
                },
                scales: baseScales(false)
            }
        };
        enableDrilldown(config.options, agg);
        drawChart(canvasId, config);
    }

    /**
     * Month x-axis, one grouped (side-by-side) bar per category per month. Used for
     * every small-category breakdown (2-5 categories) -- {months, datasets} from
     * aggregateGroupedByMonth().
     * @param {string} canvasId
     * @param {{months: string[], datasets: {label: string, data: number[]}[]}} agg
     * @param {number} total totalRecords, for the %-of-total datalabel
     */
    function renderGroupedBarChart(canvasId, agg, total) {
        var colors = paletteColors(agg.datasets.length);
        var datasets = agg.datasets.map(function(ds, i) {
            return {
                label: ds.label,
                data: ds.data,
                backgroundColor: colors[i],
                borderRadius: 4,
                borderSkipped: false,
                categoryPercentage: 0.7,
                barPercentage: 0.9,
                // Each series gets its own %-of-total labels, based on its own values --
                // a shared chart-level datalabels config can't vary per dataset.
                datalabels: valueAndPercentDatalabels(ds.data, false, total || 0)
            };
        });
        var config = {
            type: 'bar',
            data: { labels: agg.months, datasets: datasets },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, color: COLOR_TEXT } }
                },
                scales: baseScales(false)
            }
        };
        enableDrilldown(config.options, agg);
        drawChart(canvasId, config);
    }

    /**
     * Month x-axis, one stacked bar per month with segments for the top-N categories
     * (by total count) plus an "Others" catch-all -- used for high-cardinality
     * breakdowns (outlets, doctors) where grouped bars would be unreadable clutter.
     * No per-segment datalabels (too many thin segments to label legibly); relies on
     * Chart.js's default hover tooltip instead.
     * @param {string} canvasId
     * @param {{months: string[], datasets: {label: string, data: number[]}[]}} agg
     */
    function renderStackedBarChart(canvasId, agg) {
        var colors = paletteColors(agg.datasets.length);
        // "Others" (if present) is always the last dataset -- give it a neutral gray
        // instead of cycling back into the ranked palette, so it doesn't look like it's
        // one of the top-N categories.
        var lastLabel = agg.datasets.length > 0 ? agg.datasets[agg.datasets.length - 1].label : null;
        if (lastLabel === 'Others') colors[colors.length - 1] = COLOR_TICK;

        var datasets = agg.datasets.map(function(ds, i) {
            return {
                label: ds.label,
                data: ds.data,
                backgroundColor: colors[i],
                borderRadius: 2,
                borderSkipped: false,
                categoryPercentage: 0.6,
                barPercentage: 0.85
            };
        });
        var config = {
            type: 'bar',
            data: { labels: agg.months, datasets: datasets },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true, position: 'top', labels: { boxWidth: 12, color: COLOR_TEXT } }
                },
                scales: {
                    x: { stacked: true, ticks: { color: COLOR_TICK }, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true, ticks: { precision: 0, color: COLOR_TICK }, grid: { color: COLOR_GRID } }
                }
            }
        };
        enableDrilldown(config.options, agg);
        drawChart(canvasId, config);
    }

    function renderChartA1(records, period, total) {
        renderLineChart('chartA1', aggregateEnrollmentOverTime(records, period), total);
    }

    function renderAllCharts(records, outletMap, staffMap) {
        var totalRecords = records.length;

        renderChartA1(records, 'month', totalRecords);
        renderStackedBarChart('chartA3', aggregateByOutletMonthly(records, outletMap));
        renderStackedBarChart('chartA4', aggregateByDoctorMonthly(records, staffMap));

        renderGroupedBarChart('chartAnsweredCall', aggregateAnsweredCall(records), totalRecords);
        renderGroupedBarChart('chartB1', aggregateConsentStatus(records), totalRecords);
        renderGroupedBarChart('chartB2', aggregateNonEligibilityReasons(records), totalRecords);
        renderGroupedBarChart('chartB3', aggregateAddOnStatus(records), totalRecords);
        renderAddOnUsageChart(records);
        renderGroupedBarChart('chartB4', aggregateAdviseTypeBreakdown(records), totalRecords);
        renderGroupedBarChart('chartB5', aggregateConsultationStatusByType(records), totalRecords);
        renderGroupedBarChart('chartB6', aggregateProcessStatus(records), totalRecords);
        renderGroupedBarChart('chartB7', aggregateModeOfAction(records), totalRecords);

        renderMonthlySummaryTable(records);
        renderEnrollmentMonthlyTable(records);
    }

    // ---- Enrollment Data / Time monthly breakdown table ----
    // Rows = enrollment_type (New Case / Follow-up) + Total, columns = one per
    // month present in the filtered dataset (dynamic range, not a fixed Jan-Dec),
    // plus a Total column -- same data as chartA1 in table form.

    function aggregateEnrollmentByTypeMonthly(records) {
        var byMonth = {};
        for (var i = 0; i < records.length; i++) {
            var d = parseDateOnly(records[i].enrollment_date);
            if (!d) continue;
            var key = bucketKey(d, 'month');
            if (!byMonth[key]) byMonth[key] = { newCase: 0, followUp: 0 };
            var t = parseInt(records[i].enrollment_type, 10);
            if (t === 1) byMonth[key].newCase++;
            else if (t === 2) byMonth[key].followUp++;
        }
        var keys = Object.keys(byMonth).sort();
        return {
            keys: keys,
            months: keys.map(function(k) { return formatBucketLabel(k, 'month'); }),
            newCase: keys.map(function(k) { return byMonth[k].newCase; }),
            followUp: keys.map(function(k) { return byMonth[k].followUp; })
        };
    }

    /**
     * Inline background-color for a heatmap-style table cell -- intensity scales with
     * value/rowOrColumnMax so the busiest months/metrics visually pop without a chart.
     * Empty string (no styling) for zero/blank cells or when there's nothing to scale against.
     * @param {number} value This cell's value
     * @param {number} maxValue The max value across the row/column this cell belongs to
     * @param {string} rgb "r,g,b" triplet, e.g. '42,120,214' for blue
     * @returns {string} A ` style="..."` attribute fragment, or ''
     */
    function heatCellStyle(value, maxValue, rgb) {
        if (!value || maxValue <= 0) return '';
        var ratio = Math.min(value / maxValue, 1);
        var opacity = 0.10 + ratio * 0.55;
        return ' style="background-color: rgba(' + rgb + ', ' + opacity.toFixed(2) + ');"';
    }

    /**
     * Build an index.php URL that lists the consult calls behind one cell of the
     * Enrollment Type Breakdown table, using the filters the report was loaded with.
     * The month range is clipped to the report's own Enrollment From/To so the
     * list count matches the cell.
     * @param {number|null} enrollmentType 1 = New Case, 2 = Follow-up, null = both
     * @param {string|null} monthKey 'YYYY-MM', or null for the whole report range
     * @returns {string}
     */
    function buildEnrollmentListUrl(enrollmentType, monthKey) {
        var filters = state.filters || {};
        var from = filters.date_from || '';
        var to = filters.date_to || '';

        if (monthKey) {
            var range = clippedMonthRange(monthKey);
            from = range.from;
            to = range.to;
        }

        var extra = {};
        if (enrollmentType) extra.enrollment_type = enrollmentType;
        return buildListUrl(extra, from, to);
    }

    /**
     * First and last day ('YYYY-MM-DD') of a 'YYYY-MM' month key.
     * @param {string} monthKey
     * @returns {{from: string, to: string}}
     */
    function monthRange(monthKey) {
        var parts = monthKey.split('-');
        var lastDay = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate();
        return { from: monthKey + '-01', to: monthKey + '-' + pad2(lastDay) };
    }

    /**
     * A month's first/last day, clipped to the report's Enrollment From/To so a
     * drill-down list never covers days the report itself excluded.
     * @param {string} monthKey 'YYYY-MM'
     * @returns {{from: string, to: string}}
     */
    function clippedMonthRange(monthKey) {
        var filters = state.filters || {};
        var range = monthRange(monthKey);
        return {
            from: (filters.date_from && filters.date_from > range.from) ? filters.date_from : range.from,
            to: (filters.date_to && filters.date_to < range.to) ? filters.date_to : range.to
        };
    }

    /**
     * index.php URL carrying the report's doctor/outlet filters, the given
     * enrollment range, and any extra index.php query params (extra wins over the
     * report's doctor/outlet, e.g. when a doctor or outlet bar was clicked).
     * @param {object} extra Extra query params (e.g. { consent_call_status: 1 })
     * @param {string} enrollmentFrom Enrollment From ('YYYY-MM-DD' or '')
     * @param {string} enrollmentTo Enrollment To ('YYYY-MM-DD' or '')
     * @returns {string}
     */
    function buildListUrl(extra, enrollmentFrom, enrollmentTo) {
        var filters = state.filters || {};
        var query = [];
        Object.keys(extra).forEach(function(key) {
            query.push(key + '=' + encodeURIComponent(extra[key]));
        });
        if (enrollmentFrom) query.push('date_from=' + encodeURIComponent(enrollmentFrom));
        if (enrollmentTo) query.push('date_to=' + encodeURIComponent(enrollmentTo));
        if (filters.consulted_by && !extra.hasOwnProperty('consulted_by')) {
            query.push('consulted_by=' + encodeURIComponent(filters.consulted_by));
        }
        if (filters.outlet_id && !extra.hasOwnProperty('outlet_id')) {
            query.push('outlet_id=' + encodeURIComponent(filters.outlet_id));
            var outletSelect = document.getElementById('rptOutletFilter');
            var outletOption = outletSelect ? outletSelect.querySelector('option[value="' + filters.outlet_id + '"]') : null;
            if (outletOption) query.push('outlet_code=' + encodeURIComponent(outletOption.textContent.trim()));
        }

        return CC_CONFIG.baseUrl + 'index.php' + (query.length ? '?' + query.join('&') : '');
    }

    function renderEnrollmentMonthlyTable(records) {
        var thead = document.getElementById('enrollmentMonthlyTableHead');
        var tbody = document.getElementById('enrollmentMonthlyTableBody');
        if (!thead || !tbody) return;

        var summary = aggregateEnrollmentByTypeMonthly(records);

        if (summary.months.length === 0) {
            thead.innerHTML = '<th class="text-center">Type</th><th class="text-center">Total</th>';
            tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted py-3">No data for the selected filters.</td></tr>';
            return;
        }

        var headHtml = '<th class="text-center">Type</th>';
        for (var i = 0; i < summary.months.length; i++) {
            headHtml += '<th class="text-center">' + summary.months[i] + '</th>';
        }
        headHtml += '<th class="text-center">Total</th>';
        thead.innerHTML = headHtml;

        // Heatmap intensity is scaled per-row (New Case and Follow-up can sit on very
        // different scales) -- Total row stays plain/bold so it reads as a summary line,
        // not another data row.
        // Each non-zero count links to index.php filtered to the same records.
        function countCell(value, enrollmentType, monthKey, style) {
            var content = value > 0
                ? '<a href="' + escapeHtml(buildEnrollmentListUrl(enrollmentType, monthKey)) + '"'
                    + ' class="report-drilldown-link" title="View these consult calls">' + value + '</a>'
                : value;
            return '<td class="text-end"' + (style || '') + '>' + content + '</td>';
        }

        function buildRow(label, values, boldRow, rgb, enrollmentType) {
            var total = 0;
            var rowMax = rgb ? Math.max.apply(null, values) : 0;
            var row = '<tr' + (boldRow ? ' class="fw-bold"' : '') + '>' + '<td>' + label + '</td>';
            for (var j = 0; j < values.length; j++) {
                total += values[j];
                var style = rgb ? heatCellStyle(values[j], rowMax, rgb) : '';
                row += countCell(values[j], enrollmentType, summary.keys[j], style);
            }
            row += countCell(total, enrollmentType, null, '') + '</tr>';
            return row;
        }

        var totals = summary.newCase.map(function(v, idx) { return v + summary.followUp[idx]; });

        var html = buildRow('New Case', summary.newCase, false, '42,120,214', 1)
            + buildRow('Follow-up', summary.followUp, false, '235,104,52', 2)
            + buildRow('Total', totals, true, null, null);

        tbody.innerHTML = html;
    }

    // ---- Monthly Performance Summary table ----

    /**
     * Monthly breakdown of three headline counts:
     *   obtained          - consent_call_status = Obtained, bucketed by the month
     *                       consent was obtained (consent_call_date, falls back to
     *                       enrollment_date when consent_call_date is missing)
     *   completed         - latest non-draft detail's consult_status = Completed,
     *                       bucketed by that detail's consult_date
     *   referredInternal  - latest non-draft detail's action = Refer Internal,
     *                       bucketed by that same detail's consult_date
     * @param {Array} records Consult call records
     * @returns {{months: string[], obtained: number[], completed: number[], referredInternal: number[]}}
     */
    function aggregateMonthlySummary(records) {
        var byMonth = {};

        function bucket(monthKey) {
            if (!byMonth[monthKey]) {
                byMonth[monthKey] = { obtained: 0, completed: 0, referredInternal: 0 };
            }
            return byMonth[monthKey];
        }

        for (var i = 0; i < records.length; i++) {
            var rec = records[i];

            if (parseInt(rec.consent_call_status, 10) === 1) {
                var consentDate = parseDateOnly(rec.consent_call_date) || parseDateOnly(rec.enrollment_date);
                if (consentDate) bucket(bucketKey(consentDate, 'month')).obtained++;
            }

            var det = getLatestNonDraftDetail(rec);
            if (det) {
                var consultDate = parseDateOnly(det.consult_date);
                if (consultDate) {
                    var row = bucket(bucketKey(consultDate, 'month'));
                    if (parseInt(det.consult_status, 10) === 1) row.completed++;
                    if (parseInt(det.action, 10) === 1) row.referredInternal++;
                }
            }
        }

        var keys = Object.keys(byMonth).sort();
        return {
            keys: keys,
            months: keys.map(function(k) { return formatBucketLabel(k, 'month'); }),
            obtained: keys.map(function(k) { return byMonth[k].obtained; }),
            completed: keys.map(function(k) { return byMonth[k].completed; }),
            referredInternal: keys.map(function(k) { return byMonth[k].referredInternal; })
        };
    }

    function renderMonthlySummaryTable(records) {
        var tbody = document.getElementById('monthlySummaryTableBody');
        if (!tbody) return;

        var summary = aggregateMonthlySummary(records);

        if (summary.months.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No data for the selected filters.</td></tr>';
            return;
        }

        // Each non-zero count links to index.php filtered to the same records: the
        // report's enrollment range/doctor/outlet, plus the metric's own status and
        // date range (consent date for Obtained, consult date for the other two).
        var filters = state.filters || {};
        var metricFilters = {
            obtained: function(range) {
                return { consent_call_status: 1, consent_date_from: range.from, consent_date_to: range.to };
            },
            completed: function(range) {
                return { consult_status: 1, consult_date_from: range.from, consult_date_to: range.to };
            },
            referredInternal: function(range) {
                return { detail_action: 1, consult_date_from: range.from, consult_date_to: range.to };
            }
        };

        function metricCell(value, metric, range, style) {
            var content = value;
            if (value > 0) {
                var url = buildListUrl(metricFilters[metric](range), filters.date_from || '', filters.date_to || '');
                content = '<a href="' + escapeHtml(url) + '" class="report-drilldown-link"'
                    + ' title="View these consult calls">' + value + '</a>';
            }
            return '<td class="text-end"' + (style || '') + '>' + content + '</td>';
        }

        // Total row spans the first to last month shown.
        var fullRange = {
            from: monthRange(summary.keys[0]).from,
            to: monthRange(summary.keys[summary.keys.length - 1]).to
        };

        // Heatmap intensity is scaled per-column -- the three metrics naturally sit on
        // different scales, so each gets its own max and its own hue.
        var maxObtained = Math.max.apply(null, summary.obtained);
        var maxCompleted = Math.max.apply(null, summary.completed);
        var maxReferredInternal = Math.max.apply(null, summary.referredInternal);

        var totalObtained = 0, totalCompleted = 0, totalReferredInternal = 0;
        var html = '';
        for (var i = 0; i < summary.months.length; i++) {
            totalObtained += summary.obtained[i];
            totalCompleted += summary.completed[i];
            totalReferredInternal += summary.referredInternal[i];
            var range = monthRange(summary.keys[i]);
            html += '<tr>'
                + '<td>' + summary.months[i] + '</td>'
                + metricCell(summary.obtained[i], 'obtained', range, heatCellStyle(summary.obtained[i], maxObtained, '42,120,214'))
                + metricCell(summary.completed[i], 'completed', range, heatCellStyle(summary.completed[i], maxCompleted, '27,175,122'))
                + metricCell(summary.referredInternal[i], 'referredInternal', range, heatCellStyle(summary.referredInternal[i], maxReferredInternal, '235,104,52'))
                + '</tr>';
        }
        html += '<tr class="fw-bold">'
            + '<td>Total</td>'
            + metricCell(totalObtained, 'obtained', fullRange, '')
            + metricCell(totalCompleted, 'completed', fullRange, '')
            + metricCell(totalReferredInternal, 'referredInternal', fullRange, '')
            + '</tr>';

        tbody.innerHTML = html;
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
            state.filters = filters;

            resolveNames(records).then(function(maps) {
                renderAllCharts(records, maps.outletMap, maps.staffMap);
                setLoadingState(false);
            });
        })['catch'](function() {
            setLoadingState(false);
        });
    }

    function resetFilters() {
        // Reset to the same default range report.php renders with.
        document.getElementById('rptDateFrom').value = CC_CONFIG.defaultDateFrom;
        document.getElementById('rptDateTo').value = CC_CONFIG.defaultDateTo;
        document.getElementById('rptOutletFilter').value = '';
        document.getElementById('rptDoctorFilter').value = '';
        loadReport();
    }

    document.addEventListener('DOMContentLoaded', function() {
        document.getElementById('rptApplyBtn').addEventListener('click', loadReport);
        document.getElementById('rptResetBtn').addEventListener('click', resetFilters);

        loadReport();
    });
})();
