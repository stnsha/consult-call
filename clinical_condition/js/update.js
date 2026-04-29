(function () {
    'use strict';

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

    function showAlert(msg, success) {
        var el = document.getElementById('form-alert');
        var msgEl = document.getElementById('form-alert-msg');
        if (!el || !msgEl) return;
        el.classList.remove('alert-success', 'alert-danger');
        el.classList.add(success ? 'alert-success' : 'alert-danger');
        el.style.display = 'block';
        msgEl.textContent = msg;
    }

    function populateForm(condition) {
        var displayId = document.getElementById('display-id');
        if (displayId) displayId.textContent = condition.id;

        var displayEvaluator = document.getElementById('display-evaluator');
        if (displayEvaluator) displayEvaluator.textContent = condition.evaluator || '-';

        var displayCriteria = document.getElementById('display-criteria-count');
        if (displayCriteria) displayCriteria.textContent = condition.criteria_count !== undefined ? condition.criteria_count : '-';

        var fieldDesc = document.getElementById('field-description');
        if (fieldDesc) fieldDesc.value = condition.description || '';

        var fieldRisk = document.getElementById('field-risk-tier');
        if (fieldRisk) fieldRisk.value = String(condition.risk_tier !== undefined ? condition.risk_tier : 0);

        document.getElementById('form-loading').style.display = 'none';
        document.getElementById('update-form').style.display = 'block';
    }

    function loadCondition() {
        apiCall('get-clinical-conditions', {}).then(function (result) {
            if (!result.success) {
                document.getElementById('form-loading').textContent = 'Failed to load condition data.';
                return;
            }

            var conditions = result.data || [];
            var found = null;
            for (var i = 0; i < conditions.length; i++) {
                if (String(conditions[i].id) === String(CC_CONFIG.conditionId)) {
                    found = conditions[i];
                    break;
                }
            }

            if (!found) {
                document.getElementById('form-loading').textContent = 'Clinical condition not found.';
                return;
            }

            populateForm(found);
        }).catch(function () {
            document.getElementById('form-loading').textContent = 'Network error. Please refresh the page.';
        });
    }

    var form = document.getElementById('update-form');
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var descField = document.getElementById('field-description');
            var riskField = document.getElementById('field-risk-tier');
            var description = descField ? descField.value.trim() : '';
            var riskTier = riskField ? parseInt(riskField.value, 10) : 0;

            if (!description) {
                showAlert('Description is required.', false);
                return;
            }

            var saveBtn = document.getElementById('save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            apiCall('update-clinical-condition', {
                id: CC_CONFIG.conditionId,
                data: {
                    description: description,
                    risk_tier: riskTier
                }
            }).then(function (result) {
                if (result.success) {
                    showAlert('Clinical condition updated successfully.', true);
                    setTimeout(function () {
                        window.location.href = '/odb/consultcall/clinical_condition/index.php';
                    }, 800);
                } else {
                    showAlert(result.message || 'Failed to update clinical condition.', false);
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Save Changes';
                    }
                }
            }).catch(function () {
                showAlert('Network error. Please try again.', false);
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                }
            });
        });
    }

    loadCondition();

})();
