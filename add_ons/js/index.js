(function () {
    'use strict';

    var allAddOns = [];
    var filteredAddOns = [];
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
        return fetch(AO_CONFIG.apiUrl, {
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

    function isAddOnActive(row) {
        return row.is_active === true || row.is_active === 1 || row.is_active === '1';
    }

    function sortByActiveFirst(list) {
        return list.slice().sort(function (a, b) {
            return (isAddOnActive(b) ? 1 : 0) - (isAddOnActive(a) ? 1 : 0);
        });
    }

    function renderTable(data) {
        var tbody = document.getElementById('add-ons-tbody');
        if (!tbody) return;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="' + AO_CONFIG.colSpan + '" class="text-center text-muted py-4">No add-ons found.</td></tr>';
            return;
        }

        var html = '';
        for (var i = 0; i < data.length; i++) {
            var row = data[i];
            var isActive = isAddOnActive(row);
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
            if (AO_CONFIG.canManage) {
                html += '<button type="button" class="btn btn-sm btn-outline-primary me-1 edit-btn" '
                      + 'data-id="' + escapeHtml(row.id) + '" data-name="' + escapeHtml(row.name) + '" style="font-size:11px;">Edit</button>';
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
        var total = filteredAddOns.length;
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
        var nameEl = document.getElementById('filter-name');
        var statusEl = document.getElementById('filter-status');
        var nameTerm = nameEl ? nameEl.value.trim().toLowerCase() : '';
        var statusTerm = statusEl ? statusEl.value : '';

        filteredAddOns = allAddOns.filter(function (row) {
            if (nameTerm && String(row.name || '').toLowerCase().indexOf(nameTerm) === -1) {
                return false;
            }
            if (statusTerm) {
                var active = isAddOnActive(row);
                if (statusTerm === 'active' && !active) return false;
                if (statusTerm === 'inactive' && active) return false;
            }
            return true;
        });

        currentPage = 1;
        renderPage();
    }

    function renderPage() {
        var total = filteredAddOns.length;
        var totalPages = Math.max(1, Math.ceil(total / perPage));
        if (currentPage > totalPages) currentPage = totalPages;
        var start = (currentPage - 1) * perPage;
        var slice = filteredAddOns.slice(start, start + perPage);
        renderTable(slice);
        renderPagination(totalPages, total);
    }

    function loadAddOns() {
        var tbody = document.getElementById('add-ons-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="' + AO_CONFIG.colSpan + '" class="text-center text-muted py-4">Loading...</td></tr>';
        }

        apiCall('get-all-add-ons', {}).then(function (result) {
            if (result.success) {
                allAddOns = sortByActiveFirst(result.data || []);
                applyFilters();
            } else {
                showAlert(result.message || 'Failed to load add-ons.');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="' + AO_CONFIG.colSpan + '" class="text-center text-muted py-4">Failed to load data.</td></tr>';
                }
            }
        }).catch(function () {
            showAlert('Network error. Please refresh the page.');
        });
    }

    function toggleAddOn(id) {
        var btn = document.querySelector('.toggle-btn[data-id="' + id + '"]');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saving...';
        }

        apiCall('toggle-add-on', { id: id }).then(function (result) {
            if (result.success) {
                loadAddOns();
            } else {
                showAlert(result.message || 'Failed to toggle add-on.');
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

    var addOnModalEl = document.getElementById('add-on-modal');
    var addOnModal = addOnModalEl ? new bootstrap.Modal(addOnModalEl) : null;

    function openModal(id, name) {
        var titleEl = document.getElementById('add-on-modal-title');
        var idEl = document.getElementById('add-on-id');
        var nameEl = document.getElementById('add-on-name');
        var alertEl = document.getElementById('modal-alert');
        if (alertEl) alertEl.style.display = 'none';
        if (idEl) idEl.value = id || '';
        if (nameEl) nameEl.value = name || '';
        if (titleEl) titleEl.textContent = id ? 'Edit Add On' : 'Add New Add On';
        if (addOnModal) addOnModal.show();
    }

    var addNewBtn = document.getElementById('add-new-btn');
    if (addNewBtn) {
        addNewBtn.addEventListener('click', function () {
            openModal('', '');
        });
    }

    var addOnForm = document.getElementById('add-on-form');
    if (addOnForm) {
        addOnForm.addEventListener('submit', function (e) {
            e.preventDefault();

            var idEl = document.getElementById('add-on-id');
            var nameEl = document.getElementById('add-on-name');
            var id = idEl ? idEl.value : '';
            var name = nameEl ? nameEl.value.trim() : '';

            var alertEl = document.getElementById('modal-alert');
            if (alertEl) alertEl.style.display = 'none';

            if (!name) {
                showModalAlert('Name is required.');
                return;
            }

            var saveBtn = document.getElementById('add-on-save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            var action = id ? 'update-add-on' : 'create-add-on';
            var payload = id ? { id: id, data: { name: name } } : { data: { name: name } };

            apiCall(action, payload).then(function (result) {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save';
                }
                if (result.success) {
                    if (addOnModal) addOnModal.hide();
                    loadAddOns();
                } else {
                    showModalAlert(result.message || 'Failed to save add-on.');
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
                var confirmed = window.confirm('Are you sure you want to set this add-on as inactive? It will no longer appear in the Recommended Add Ons dropdown.');
                if (!confirmed) return;
            }

            toggleAddOn(id);
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

    loadAddOns();

})();
