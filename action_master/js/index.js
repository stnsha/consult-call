(function () {
    'use strict';

    // Actions maintenance page (action_master): list, search/filter, add, rename,
    // activate/deactivate. Mirrors add_ons/js/index.js.

    var allActions = [];
    var filteredActions = [];
    var currentPage = 1;
    var perPage = 15;
    var filterDebounce = null;

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
        return fetch(AM_CONFIG.apiUrl, {
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

    function showModalAlert(msg) {
        var el = document.getElementById('modal-alert');
        if (el) {
            el.textContent = msg;
            el.style.display = 'block';
        }
    }

    /**
     * First validation message from a Laravel 422 response, falling back to the
     * general message (e.g. "The name has already been taken.").
     */
    function firstErrorMessage(result, fallback) {
        if (result && result.errors) {
            for (var field in result.errors) {
                if (result.errors.hasOwnProperty(field) && result.errors[field].length) {
                    return result.errors[field][0];
                }
            }
        }
        return (result && result.message) || fallback;
    }

    function isActionActive(row) {
        return row.is_active === true || row.is_active === 1 || row.is_active === '1';
    }

    function sortByActiveFirst(list) {
        return list.slice().sort(function (a, b) {
            return (isActionActive(b) ? 1 : 0) - (isActionActive(a) ? 1 : 0);
        });
    }

    function renderTable(data) {
        var tbody = document.getElementById('actions-tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + AM_CONFIG.colSpan + '" class="text-center text-muted py-4">No actions found.</td></tr>';
            return;
        }

        var html = '';
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var isActive = isActionActive(row);
            var statusBadge = isActive ? 'bg-success' : 'bg-secondary';
            var statusLabel = isActive ? 'Active' : 'Inactive';
            var toggleLabel = isActive ? 'Set Inactive' : 'Set Active';
            var toggleClass = isActive ? 'btn-outline-danger' : 'btn-outline-success';
            var rowNum = (currentPage - 1) * perPage + i + 1;

            html += '<tr id="row-' + escapeHtml(row.id) + '">';
            html += '<td class="text-muted">' + rowNum + '</td>';
            html += '<td>' + escapeHtml(row.name) + '</td>';
            html += '<td><span class="badge ' + statusBadge + '">' + statusLabel + '</span></td>';

            html += '<td>';
            if (AM_CONFIG.canManage) {
                html += '<button type="button" class="btn btn-sm btn-outline-primary me-1 edit-btn" '
                      + 'data-id="' + escapeHtml(row.id) + '" data-name="' + escapeHtml(row.name) + '" '
                      + 'style="font-size:11px;">Edit</button>';
                html += '<button type="button" class="btn btn-sm ' + toggleClass + ' toggle-btn" '
                      + 'data-id="' + escapeHtml(row.id) + '" style="font-size:11px;">' + escapeHtml(toggleLabel) + '</button>';
            }
            html += '</td>';

            html += '</tr>';
        }

        tbody.innerHTML = html;
    }

    function handlePageClick(e) {
        e.preventDefault();
        var page = this.getAttribute('data-page');
        var totalPages = Math.max(1, Math.ceil(filteredActions.length / perPage));
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
        var nameEl = document.getElementById('filter-name');
        var statusEl = document.getElementById('filter-status');
        var nameTerm = nameEl ? nameEl.value.trim().toLowerCase() : '';
        var statusTerm = statusEl ? statusEl.value : '';

        filteredActions = allActions.filter(function (row) {
            if (nameTerm && String(row.name || '').toLowerCase().indexOf(nameTerm) === -1) {
                return false;
            }
            if (statusTerm) {
                var active = isActionActive(row);
                if (statusTerm === 'active' && !active) return false;
                if (statusTerm === 'inactive' && active) return false;
            }
            return true;
        });

        currentPage = 1;
        renderPage();
    }

    function renderPage() {
        var total = filteredActions.length;
        var totalPages = Math.max(1, Math.ceil(total / perPage));
        if (currentPage > totalPages) currentPage = totalPages;
        var start = (currentPage - 1) * perPage;
        renderTable(filteredActions.slice(start, start + perPage));
        renderPagination(totalPages, total);
    }

    function loadActions() {
        var tbody = document.getElementById('actions-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="' + AM_CONFIG.colSpan + '" class="text-center text-muted py-4">Loading...</td></tr>';
        }

        apiCall('get-all-action-masters', {}).then(function (result) {
            if (result.success) {
                allActions = sortByActiveFirst(result.data || []);
                applyFilters();
            } else {
                showAlert(result.message || 'Failed to load actions.');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="' + AM_CONFIG.colSpan + '" class="text-center text-muted py-4">Failed to load data.</td></tr>';
                }
            }
        }).catch(function () {
            showAlert('Network error. Please refresh the page.');
        });
    }

    function toggleAction(id) {
        var btn = document.querySelector('.toggle-btn[data-id="' + id + '"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saving...';
        }

        apiCall('toggle-action-master', { id: id }).then(function (result) {
            if (result.success) {
                loadActions();
            } else {
                showAlert(result.message || 'Failed to toggle action.');
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

    // -- Add / Edit modal --

    var actionModalEl = document.getElementById('action-modal');
    var actionModal = actionModalEl ? new bootstrap.Modal(actionModalEl) : null;

    function openModal(id, name) {
        var titleEl = document.getElementById('action-modal-title');
        var idEl = document.getElementById('action-id');
        var nameEl = document.getElementById('action-name');
        var alertEl = document.getElementById('modal-alert');
        if (alertEl) alertEl.style.display = 'none';
        if (idEl) idEl.value = id || '';
        if (nameEl) nameEl.value = name || '';
        if (titleEl) titleEl.textContent = id ? 'Edit Action' : 'Add New Action';
        if (actionModal) actionModal.show();
    }

    var addNewBtn = document.getElementById('add-new-btn');
    if (addNewBtn) {
        addNewBtn.addEventListener('click', function () {
            openModal('', '');
        });
    }

    var actionForm = document.getElementById('action-form');
    if (actionForm) {
        actionForm.addEventListener('submit', function (e) {
            e.preventDefault();

            var idEl = document.getElementById('action-id');
            var nameEl = document.getElementById('action-name');
            var id = idEl ? idEl.value : '';
            var name = nameEl ? nameEl.value.trim() : '';

            var alertEl = document.getElementById('modal-alert');
            if (alertEl) alertEl.style.display = 'none';

            if (!name) {
                showModalAlert('Name is required.');
                return;
            }

            var saveBtn = document.getElementById('action-save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            var apiAction = id ? 'update-action-master' : 'create-action-master';
            var payload = id ? { id: id, data: { name: name } } : { data: { name: name } };

            apiCall(apiAction, payload).then(function (result) {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }
                if (result.success) {
                    if (actionModal) actionModal.hide();
                    loadActions();
                } else {
                    showModalAlert(firstErrorMessage(result, 'Failed to save action.'));
                }
            }).catch(function () {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }
                showModalAlert('Network error. Please try again.');
            });
        });
    }

    document.addEventListener('click', function (e) {
        if (e.target && e.target.classList.contains('edit-btn')) {
            openModal(e.target.getAttribute('data-id'), e.target.getAttribute('data-name'));
            return;
        }

        if (e.target && e.target.classList.contains('toggle-btn')) {
            var id = e.target.getAttribute('data-id');
            var isSettingInactive = e.target.classList.contains('btn-outline-danger');

            if (!id) return;

            if (isSettingInactive) {
                var confirmed = window.confirm('Are you sure you want to set this action as inactive? It will no longer appear in the Action dropdown.');
                if (!confirmed) return;
            }

            toggleAction(id);
        }
    });

    var filterNameEl = document.getElementById('filter-name');
    if (filterNameEl) {
        filterNameEl.addEventListener('input', function () {
            clearTimeout(filterDebounce);
            filterDebounce = setTimeout(applyFilters, 250);
        });
    }

    var filterStatusEl = document.getElementById('filter-status');
    if (filterStatusEl) {
        filterStatusEl.addEventListener('change', applyFilters);
    }

    loadActions();

})();
