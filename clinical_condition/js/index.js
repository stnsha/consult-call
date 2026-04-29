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

            html += '<tr id="row-' + escapeHtml(row.id) + '">';
            html += '<td class="text-muted">' + (i + 1) + '</td>';
            html += '<td>' + escapeHtml(row.description) + '</td>';
            html += '<td><span class="badge ' + tierBadge + '">' + escapeHtml(tierLabel) + '</span></td>';
            html += '<td><span class="badge ' + statusBadge + '">' + statusLabel + '</span></td>';

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

    function loadConditions() {
        var tbody = document.getElementById('conditions-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="' + CC_CONFIG.colSpan + '" class="text-center text-muted py-4">Loading...</td></tr>';
        }

        apiCall('get-clinical-conditions', {}).then(function (result) {
            if (result.success) {
                renderTable(result.data);
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
