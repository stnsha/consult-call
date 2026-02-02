/**
 * Telehealth Consultation Dashboard - Main JavaScript
 * Handles filter functionality for the patient table
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

    /**
     * Apply filters to the table
     */
    function applyFilters() {
        var searchValue = searchInput.value.toLowerCase();
        var consentValue = consentFilter.value;
        var processValue = processFilter.value;
        var reminderValue = reminderFilter.value;
        var enrollmentValue = enrollmentFilter.value;
        var fromDate = dateFrom.value;
        var toDate = dateTo.value;
        var lastConsultFromDate = lastConsultFrom.value;
        var lastConsultToDate = lastConsultTo.value;

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

            // Show or hide row
            if (showRow) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        }

        // Update row numbers for visible rows
        updateRowNumbers();
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

        // Show all rows
        for (var i = 0; i < rows.length; i++) {
            rows[i].classList.remove('hidden');
        }

        // Update row numbers
        updateRowNumbers();
    }

    /**
     * Update row numbers for visible rows
     */
    function updateRowNumbers() {
        var visibleIndex = 1;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (!row.classList.contains('hidden')) {
                var cells = row.getElementsByTagName('td');
                cells[0].textContent = visibleIndex;
                visibleIndex++;
            }
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
});
