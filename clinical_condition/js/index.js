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
    var currentPage = 1;
    var perPage = 15;

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
            var isActive = row.is_active === true || row.is_active === 1 || row.is_active === '1';
            var statusBadge = isActive ? 'bg-success' : 'bg-secondary';
            var statusLabel = isActive ? 'Active' : 'Inactive';
            var toggleLabel = isActive ? 'Set Inactive' : 'Set Active';
            var toggleClass = isActive ? 'btn-outline-danger' : 'btn-outline-success';
            var rowNum = (currentPage - 1) * perPage + i + 1;

            html += '<tr id="row-' + escapeHtml(row.id) + '">';
            html += '<td class="text-muted">' + rowNum + '</td>';
            html += '<td>' + escapeHtml(row.description) + '</td>';
            html += '<td><span class="badge ' + tierBadge + '">' + escapeHtml(tierLabel) + '</span></td>';
            html += '<td><span class="badge ' + statusBadge + '">' + statusLabel + '</span></td>';

            html += '<td>' + formatDate(row.active_from) + '</td>';

            var disabled = CC_CONFIG.isSuperAdmin ? '' : ' disabled';
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
        var total = allConditions.length;
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

    function renderPage() {
        var total = allConditions.length;
        var totalPages = Math.max(1, Math.ceil(total / perPage));
        if (currentPage > totalPages) currentPage = totalPages;
        var start = (currentPage - 1) * perPage;
        var slice = allConditions.slice(start, start + perPage);
        renderTable(slice);
        renderPagination(totalPages, total);
    }

    function loadConditions() {
        var tbody = document.getElementById('conditions-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="' + CC_CONFIG.colSpan + '" class="text-center text-muted py-4">Loading...</td></tr>';
        }

        apiCall('get-clinical-conditions', {}).then(function (result) {
            if (result.success) {
                allConditions = result.data || [];
                renderPage();
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

    document.addEventListener('click', function (e) {
        if (e.target && e.target.classList.contains('toggle-btn')) {
            if (!CC_CONFIG.isSuperAdmin) return;

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

    loadConditions();

})();
