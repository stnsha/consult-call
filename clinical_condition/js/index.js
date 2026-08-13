(function () {
    'use strict';

    var RISK_TIER_LABELS = {
        0: 'Healthy',
        1: 'Low',
        2: 'Medium',
        3: 'High'
    };

    var RISK_TIER_BADGES = {
        0: 'bg-secondary',
        1: 'bg-success',
        2: 'bg-warning text-dark',
        3: 'bg-danger'
    };

    var allConditions = [];
    var filteredConditions = [];
    var currentPage = 1;
    var perPage = 30;
    var selectedIds = {};
    var filterDebounce = null;

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        var parts = dateStr.substr(0, 10).split('-');
        if (parts.length !== 3) return dateStr;
        var d = parseInt(parts[2], 10);
        var m = parseInt(parts[1], 10) - 1;
        var y = parts[0];
        return d + ' ' + months[m] + ' ' + y;
    }

    function isConditionActive(row) {
        return row.is_active === true || row.is_active === 1 || row.is_active === '1';
    }

    function sortByActiveFirst(list) {
        return list.slice().sort(function (a, b) {
            return (isConditionActive(b) ? 1 : 0) - (isConditionActive(a) ? 1 : 0);
        });
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str === null || str === undefined ? '' : str)));
        return div.innerHTML;
    }

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
        }).then(function (response) {
            return response.json();
        });
    }

    function showAlert(msg) {
        var el = document.getElementById('table-alert');
        var msgEl = document.getElementById('table-alert-msg');
        if (el && msgEl) {
            msgEl.textContent = msg;
            el.style.display = 'block';
        }
    }

    var TYPE_OPTIONS = ['CC', 'AO', 'CC + AO'];

    function findConditionById(id) {
        for (var i = 0; i < allConditions.length; i++) {
            if (String(allConditions[i].id) === String(id)) return allConditions[i];
        }
        return null;
    }

    // Inline-editable Type cell: a select for super admins (matches the Update link
    // gating), read-only text for everyone else.
    function renderTypeCell(row) {
        if (!CC_CONFIG.isSuperAdmin) {
            return row.type ? escapeHtml(row.type) : '-';
        }
        var html = '<select class="form-select form-select-sm type-select" data-id="' + escapeHtml(row.id) + '" style="font-size:11px;">';
        html += '<option value=""' + (!row.type ? ' selected' : '') + '>-</option>';
        for (var i = 0; i < TYPE_OPTIONS.length; i++) {
            var opt = TYPE_OPTIONS[i];
            html += '<option value="' + escapeHtml(opt) + '"' + (row.type === opt ? ' selected' : '') + '>' + escapeHtml(opt) + '</option>';
        }
        html += '</select>';
        return html;
    }

    function updateType(id, newType, selectEl) {
        var condition = findConditionById(id);
        if (!condition) return;

        var previousType = condition.type || '';
        selectEl.disabled = true;

        apiCall('update-clinical-condition', {
            id: id,
            data: {
                description: condition.description,
                type: newType,
                risk_tier: parseInt(condition.risk_tier, 10) || 0,
                active_from: condition.active_from ? condition.active_from.substr(0, 10) : null
            }
        }).then(function (result) {
            selectEl.disabled = false;
            if (result.success) {
                condition.type = newType;
            } else {
                selectEl.value = previousType;
                showAlert(result.message || 'Failed to update type.');
            }
        }).catch(function () {
            selectEl.disabled = false;
            selectEl.value = previousType;
            showAlert('Network error. Please try again.');
        });
    }

    function renderTable(data) {
        var tbody = document.getElementById('conditions-tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + CC_CONFIG.colSpan + '" class="text-center text-muted py-4">No clinical conditions found.</td></tr>';
            return;
        }

        var html = '';
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var tier = parseInt(row.risk_tier, 10);
            var tierLabel = RISK_TIER_LABELS[tier] !== undefined ? RISK_TIER_LABELS[tier] : String(tier);
            var tierBadge = RISK_TIER_BADGES[tier] !== undefined ? RISK_TIER_BADGES[tier] : 'bg-secondary';
            var isActive = isConditionActive(row);
            var statusBadge = isActive ? 'bg-success' : 'bg-secondary';
            var statusLabel = isActive ? 'Active' : 'Inactive';
            var toggleLabel = isActive ? 'Set Inactive' : 'Set Active';
            var toggleClass = isActive ? 'btn-outline-danger' : 'btn-outline-success';
            var rowNum = (currentPage - 1) * perPage + i + 1;

            html += '<tr id="row-' + escapeHtml(row.id) + '">';
            if (CC_CONFIG.canToggleStatus) {
                var checked = selectedIds[row.id] ? ' checked' : '';
                html += '<td><input type="checkbox" class="row-checkbox" data-id="' + escapeHtml(row.id) + '"' + checked + '></td>';
            }
            html += '<td class="text-muted">' + rowNum + '</td>';
            html += '<td>' + escapeHtml(row.description) + '</td>';
            html += '<td>' + renderTypeCell(row) + '</td>';
            html += '<td><span class="badge ' + tierBadge + '">' + escapeHtml(tierLabel) + '</span></td>';
            html += '<td><span class="badge ' + statusBadge + '">' + statusLabel + '</span></td>';

            html += '<td>' + formatDate(row.active_from) + '</td>';

            var disabled = CC_CONFIG.canToggleStatus ? '' : ' disabled';
            html += '<td>';
            html += '<a href="' + (CC_CONFIG.isSuperAdmin ? 'consultcall/clinical_condition/update.php?id=' + escapeHtml(row.id) : '#') + '" '
                  + 'class="btn btn-sm btn-outline-primary me-1' + (CC_CONFIG.isSuperAdmin ? '' : ' disabled') + '" '
                  + 'style="font-size:11px;"'
                  + (CC_CONFIG.isSuperAdmin ? '' : ' aria-disabled="true" tabindex="-1"')
                  + '>Update</a>';
            html += '<button type="button" class="btn btn-sm ' + toggleClass + ' toggle-btn" '
                  + 'data-id="' + escapeHtml(row.id) + '" style="font-size:11px;"'
                  + disabled + '>'
                  + escapeHtml(toggleLabel) + '</button>';
            html += '</td>';

            html += '</tr>';
        }

        tbody.innerHTML = html;
    }

    function handlePageClick(e) {
        e.preventDefault();
        var page = this.getAttribute('data-page');
        var total = filteredConditions.length;
        var totalPages = Math.max(1, Math.ceil(total / perPage));
        if (page === 'prev') {
            if (currentPage > 1) currentPage--;
        } else if (page === 'next') {
            if (currentPage < totalPages) currentPage++;
        } else {
            currentPage = parseInt(page, 10);
        }
        renderPage();
    }

    function renderPagination(totalPages, total) {
        var paginationInfo = document.getElementById('paginationInfo');
        var paginationControls = document.getElementById('paginationControls');
        if (!paginationInfo || !paginationControls) return;

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

    function applyFilters() {
        var descEl = document.getElementById('filter-description');
        var statusEl = document.getElementById('filter-status');
        var descTerm = descEl ? descEl.value.trim().toLowerCase() : '';
        var statusTerm = statusEl ? statusEl.value : '';

        filteredConditions = allConditions.filter(function (row) {
            if (descTerm && String(row.description || '').toLowerCase().indexOf(descTerm) === -1) {
                return false;
            }
            if (statusTerm) {
                var active = isConditionActive(row);
                if (statusTerm === 'active' && !active) return false;
                if (statusTerm === 'inactive' && active) return false;
            }
            return true;
        });

        currentPage = 1;
        renderPage();
    }

    function renderPage() {
        var total = filteredConditions.length;
        var totalPages = Math.max(1, Math.ceil(total / perPage));
        if (currentPage > totalPages) currentPage = totalPages;
        var start = (currentPage - 1) * perPage;
        var slice = filteredConditions.slice(start, start + perPage);
        renderTable(slice);
        renderPagination(totalPages, total);
        updateBulkUI();
    }

    function updateSelectAllCheckbox() {
        var selectAll = document.getElementById('select-all-checkbox');
        if (!selectAll) return;
        var boxes = document.querySelectorAll('.row-checkbox');
        if (boxes.length === 0) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
            return;
        }
        var checkedCount = 0;
        for (var i = 0; i < boxes.length; i++) {
            if (boxes[i].checked) checkedCount++;
        }
        selectAll.checked = checkedCount === boxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
    }

    function updateBulkUI() {
        if (!CC_CONFIG.canToggleStatus) return;
        updateSelectAllCheckbox();
        var bar = document.getElementById('bulk-actions-bar');
        var countEl = document.getElementById('bulk-actions-count');
        if (!bar || !countEl) return;
        var count = Object.keys(selectedIds).length;
        countEl.textContent = count + ' selected';

        var activeBtn = document.getElementById('bulk-set-active-btn');
        var inactiveBtn = document.getElementById('bulk-set-inactive-btn');
        if (activeBtn) activeBtn.disabled = false;
        if (inactiveBtn) inactiveBtn.disabled = false;
        if (count > 0) {
            bar.classList.remove('d-none');
            bar.classList.add('d-flex');
        } else {
            bar.classList.add('d-none');
            bar.classList.remove('d-flex');
        }
    }

    function bulkSetStatus(targetActive) {
        var ids = Object.keys(selectedIds);
        if (ids.length === 0) return;

        var idsNeedingChange = [];
        for (var i = 0; i < ids.length; i++) {
            var condition = null;
            for (var j = 0; j < allConditions.length; j++) {
                if (String(allConditions[j].id) === String(ids[i])) {
                    condition = allConditions[j];
                    break;
                }
            }
            var isActive = condition && isConditionActive(condition);
            if (!condition || isActive !== targetActive) {
                idsNeedingChange.push(ids[i]);
            }
        }

        if (idsNeedingChange.length === 0) {
            selectedIds = {};
            renderPage();
            return;
        }

        if (!targetActive) {
            var confirmed = window.confirm('Are you sure you want to set ' + idsNeedingChange.length + ' condition(s) as inactive? They will no longer be evaluated for consult call eligibility.');
            if (!confirmed) return;
        }

        var activeBtn = document.getElementById('bulk-set-active-btn');
        var inactiveBtn = document.getElementById('bulk-set-inactive-btn');
        if (activeBtn) activeBtn.disabled = true;
        if (inactiveBtn) inactiveBtn.disabled = true;

        var promises = [];
        for (var k = 0; k < idsNeedingChange.length; k++) {
            promises.push(apiCall('toggle-clinical-condition', { id: idsNeedingChange[k] }));
        }

        Promise.all(promises).then(function (results) {
            var failed = 0;
            for (var i = 0; i < results.length; i++) {
                if (!results[i] || !results[i].success) failed++;
            }
            if (failed > 0) {
                showAlert(failed + ' condition(s) failed to update.');
            }
            selectedIds = {};
            loadConditions();
        }).catch(function () {
            showAlert('Network error. Please try again.');
            if (activeBtn) activeBtn.disabled = false;
            if (inactiveBtn) inactiveBtn.disabled = false;
        });
    }

    function loadConditions() {
        var tbody = document.getElementById('conditions-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="' + CC_CONFIG.colSpan + '" class="text-center text-muted py-4">Loading...</td></tr>';
        }

        selectedIds = {};

        apiCall('get-clinical-conditions', {}).then(function (result) {
            if (result.success) {
                allConditions = sortByActiveFirst(result.data || []);
                applyFilters();
            } else {
                showAlert(result.message || 'Failed to load clinical conditions.');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="' + CC_CONFIG.colSpan + '" class="text-center text-muted py-4">Failed to load data.</td></tr>';
                }
            }
        }).catch(function () {
            showAlert('Network error. Please refresh the page.');
        });
    }

    function toggleCondition(id) {
        var btn = document.querySelector('.toggle-btn[data-id="' + id + '"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saving...';
        }

        apiCall('toggle-clinical-condition', { id: id }).then(function (result) {
            if (result.success) {
                loadConditions();
            } else {
                showAlert(result.message || 'Failed to toggle condition.');
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = btn.classList.contains('btn-outline-danger') ? 'Set Inactive' : 'Set Active';
                }
            }
        }).catch(function () {
            showAlert('Network error. Please try again.');
            if (btn) {
                btn.disabled = false;
            }
        });
    }

    document.addEventListener('change', function (e) {
        if (!e.target) return;

        if (e.target.id === 'select-all-checkbox') {
            var boxes = document.querySelectorAll('.row-checkbox');
            for (var i = 0; i < boxes.length; i++) {
                boxes[i].checked = e.target.checked;
                if (e.target.checked) {
                    selectedIds[boxes[i].getAttribute('data-id')] = true;
                } else {
                    delete selectedIds[boxes[i].getAttribute('data-id')];
                }
            }
            updateBulkUI();
            return;
        }

        if (e.target.classList.contains('row-checkbox')) {
            var id = e.target.getAttribute('data-id');
            if (e.target.checked) {
                selectedIds[id] = true;
            } else {
                delete selectedIds[id];
            }
            updateBulkUI();
            return;
        }

        if (e.target.classList.contains('type-select')) {
            var typeId = e.target.getAttribute('data-id');
            if (typeId) updateType(typeId, e.target.value, e.target);
        }
    });

    document.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'bulk-set-active-btn') {
            bulkSetStatus(true);
            return;
        }
        if (e.target && e.target.id === 'bulk-set-inactive-btn') {
            bulkSetStatus(false);
            return;
        }

        if (e.target && e.target.classList.contains('toggle-btn')) {
            if (!CC_CONFIG.canToggleStatus) return;

            var id = e.target.getAttribute('data-id');
            var isSettingInactive = e.target.classList.contains('btn-outline-danger');

            if (!id) return;

            if (isSettingInactive) {
                var confirmed = window.confirm('Are you sure you want to set this condition as inactive? It will no longer be evaluated for consult call eligibility.');
                if (!confirmed) return;
            }

            toggleCondition(id);
        }
    });

    var filterDescEl = document.getElementById('filter-description');
    if (filterDescEl) {
        filterDescEl.addEventListener('input', function () {
            clearTimeout(filterDebounce);
            filterDebounce = setTimeout(applyFilters, 250);
        });
    }

    var filterStatusEl = document.getElementById('filter-status');
    if (filterStatusEl) {
        filterStatusEl.addEventListener('change', applyFilters);
    }

    loadConditions();

})();
