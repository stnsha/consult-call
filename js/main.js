/**
 * Telehealth Consultation Dashboard - Main JavaScript
 * Handles filter and pagination functionality for the patient table
 */

document.addEventListener('DOMContentLoaded', function() {
    var searchInput = document.getElementById('searchInput');
    var consentFilter = document.getElementById('consentFilter');
    var processFilter = document.getElementById('processFilter');
    var reminderFilter = document.getElementById('reminderFilter');
    var enrollmentFilter = document.getElementById('enrollmentFilter');
    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');
    var lastConsultFrom = document.getElementById('lastConsultFrom');
    var lastConsultTo = document.getElementById('lastConsultTo');
    var filterBtn = document.getElementById('filterBtn');
    var resetBtn = document.getElementById('resetBtn');
    var table = document.getElementById('patientsTable');
    var tbody = table.getElementsByTagName('tbody')[0];
    var rows = tbody.getElementsByTagName('tr');

    // Pagination variables
    var currentPage = 1;
    var rowsPerPage = 10;
    var filteredRows = [];

    /**
     * Get all rows that pass the current filters
     */
    function getFilteredRows() {
        var searchValue = searchInput.value.toLowerCase();
        var consentValue = consentFilter.value;
        var processValue = processFilter.value;
        var reminderValue = reminderFilter.value;
        var enrollmentValue = enrollmentFilter.value;
        var fromDate = dateFrom.value;
        var toDate = dateTo.value;
        var lastConsultFromDate = lastConsultFrom.value;
        var lastConsultToDate = lastConsultTo.value;

        var result = [];

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var cells = row.getElementsByTagName('td');
            var showRow = true;

            // Get row data from data attributes
            var consent = row.getAttribute('data-consent');
            var process = row.getAttribute('data-process');
            var reminder = row.getAttribute('data-reminder');
            var enrollment = row.getAttribute('data-enrollment');
            var enrollmentDate = row.getAttribute('data-enrollment-date');
            var lastConsult = row.getAttribute('data-last-consult');

            // Get searchable text from cells
            var consultCallId = cells[1].textContent.toLowerCase();
            var patientDetails = cells[2].textContent.toLowerCase();

            // Search filter (ID, name, IC, phone)
            if (searchValue) {
                var matchFound = consultCallId.indexOf(searchValue) !== -1 ||
                                 patientDetails.indexOf(searchValue) !== -1;
                if (!matchFound) {
                    showRow = false;
                }
            }

            // Consent status filter
            if (consentValue && consent !== consentValue) {
                showRow = false;
            }

            // Process status filter
            if (processValue && process !== processValue) {
                showRow = false;
            }

            // Follow up reminder filter
            if (reminderValue && reminder !== reminderValue) {
                showRow = false;
            }

            // Enrollment filter
            if (enrollmentValue && enrollment !== enrollmentValue) {
                showRow = false;
            }

            // Enrollment date range filter
            if (fromDate && enrollmentDate < fromDate) {
                showRow = false;
            }
            if (toDate && enrollmentDate > toDate) {
                showRow = false;
            }

            // Last consultation date range filter
            if (lastConsultFromDate && lastConsult) {
                if (lastConsult < lastConsultFromDate) {
                    showRow = false;
                }
            }
            if (lastConsultToDate && lastConsult) {
                if (lastConsult > lastConsultToDate) {
                    showRow = false;
                }
            }
            // If filtering by last consult date and row has no last consult, hide it
            if ((lastConsultFromDate || lastConsultToDate) && !lastConsult) {
                showRow = false;
            }

            if (showRow) {
                result.push(row);
            }
        }

        return result;
    }

    /**
     * Apply filters and pagination to the table
     */
    function applyFilters() {
        // Reset to first page when filters change
        currentPage = 1;
        filteredRows = getFilteredRows();
        displayPage();
        updatePagination();
    }

    /**
     * Display current page of data
     */
    function displayPage() {
        // Hide all rows first
        for (var i = 0; i < rows.length; i++) {
            rows[i].classList.add('hidden');
        }

        // Calculate start and end index for current page
        var startIndex = (currentPage - 1) * rowsPerPage;
        var endIndex = startIndex + rowsPerPage;

        // Show only rows for current page
        for (var j = startIndex; j < endIndex && j < filteredRows.length; j++) {
            filteredRows[j].classList.remove('hidden');
        }

        // Update row numbers for visible rows
        updateRowNumbers();
    }

    /**
     * Update pagination controls
     */
    function updatePagination() {
        var totalRows = filteredRows.length;
        var totalPages = Math.ceil(totalRows / rowsPerPage);
        if (totalPages < 1) totalPages = 1;

        var paginationInfo = document.getElementById('paginationInfo');
        var paginationControls = document.getElementById('paginationControls');

        // Update info text
        var startRow = totalRows === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
        var endRow = Math.min(currentPage * rowsPerPage, totalRows);
        paginationInfo.textContent = 'Showing ' + startRow + ' to ' + endRow + ' of ' + totalRows + ' entries';

        // Build pagination controls
        var html = '';

        // Previous button
        html += '<li class="page-item ' + (currentPage === 1 ? 'disabled' : '') + '">';
        html += '<a class="page-link" href="#" data-page="prev">Previous</a>';
        html += '</li>';

        // Page numbers
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
            html += '<a class="page-link" href="#" data-page="' + p + '">' + p + '</a>';
            html += '</li>';
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
            }
            html += '<li class="page-item"><a class="page-link" href="#" data-page="' + totalPages + '">' + totalPages + '</a></li>';
        }

        // Next button
        html += '<li class="page-item ' + (currentPage === totalPages ? 'disabled' : '') + '">';
        html += '<a class="page-link" href="#" data-page="next">Next</a>';
        html += '</li>';

        paginationControls.innerHTML = html;

        // Add click handlers
        var pageLinks = paginationControls.getElementsByTagName('a');
        for (var k = 0; k < pageLinks.length; k++) {
            pageLinks[k].addEventListener('click', handlePageClick);
        }
    }

    /**
     * Handle pagination click
     */
    function handlePageClick(e) {
        e.preventDefault();
        var page = this.getAttribute('data-page');
        var totalPages = Math.ceil(filteredRows.length / rowsPerPage);
        if (totalPages < 1) totalPages = 1;

        if (page === 'prev') {
            if (currentPage > 1) {
                currentPage--;
            }
        } else if (page === 'next') {
            if (currentPage < totalPages) {
                currentPage++;
            }
        } else {
            currentPage = parseInt(page, 10);
        }

        displayPage();
        updatePagination();
    }

    /**
     * Reset all filters
     */
    function resetFilters() {
        searchInput.value = '';
        consentFilter.value = '';
        processFilter.value = '';
        reminderFilter.value = '';
        enrollmentFilter.value = '';
        dateFrom.value = '';
        dateTo.value = '';
        lastConsultFrom.value = '';
        lastConsultTo.value = '';

        // Reset pagination
        currentPage = 1;
        filteredRows = getFilteredRows();
        displayPage();
        updatePagination();
    }

    /**
     * Update row numbers for visible rows
     */
    function updateRowNumbers() {
        var startIndex = (currentPage - 1) * rowsPerPage;
        for (var i = 0; i < filteredRows.length; i++) {
            var row = filteredRows[i];
            var cells = row.getElementsByTagName('td');
            cells[0].textContent = i + 1;
        }
    }

    /**
     * Handle rows per page change
     */
    function handleRowsPerPageChange() {
        var select = document.getElementById('rowsPerPage');
        if (select) {
            rowsPerPage = parseInt(select.value, 10);
            currentPage = 1;
            displayPage();
            updatePagination();
        }
    }

    // Event listeners
    filterBtn.addEventListener('click', applyFilters);
    resetBtn.addEventListener('click', resetFilters);

    // Real-time search filtering
    searchInput.addEventListener('keyup', applyFilters);

    // Filter on dropdown change
    consentFilter.addEventListener('change', applyFilters);
    processFilter.addEventListener('change', applyFilters);
    reminderFilter.addEventListener('change', applyFilters);
    enrollmentFilter.addEventListener('change', applyFilters);

    // Filter on date change
    dateFrom.addEventListener('change', applyFilters);
    dateTo.addEventListener('change', applyFilters);
    lastConsultFrom.addEventListener('change', applyFilters);
    lastConsultTo.addEventListener('change', applyFilters);

    // Rows per page change
    var rowsPerPageSelect = document.getElementById('rowsPerPage');
    if (rowsPerPageSelect) {
        rowsPerPageSelect.addEventListener('change', handleRowsPerPageChange);
    }

    // Initialize pagination on page load
    filteredRows = getFilteredRows();
    displayPage();
    updatePagination();
});
