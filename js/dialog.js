/**
 * Shared confirm/alert dialogs for the consultcall module, replacing the
 * browser's native confirm()/alert() popups. Follows the ATEM module's
 * Bootstrap 5 modal layout (title, message body, Cancel and action buttons),
 * with its own scoped styling (.cc-dialog) so the host page's global styles
 * (e.g. centred text from the outer ODB layout) do not leak in.
 *
 * Load after bootstrap.bundle.min.js and before the page script:
 *   ccConfirm(message, { title, okText, cancelText, danger, variant }) -> Promise<boolean>
 *   ccAlert(message, { title, okText, variant }) -> Promise<void>
 *
 * variant picks the header icon: 'info', 'question', 'warning', 'danger' or
 * 'success'. Defaults: confirm = 'question' ('danger' when danger is set),
 * alert = 'info'. danger also turns the action button red.
 *
 * Dialogs are queued, so a second call waits until the first one is closed.
 * The message is set with textContent (never innerHTML); line breaks ("\n")
 * are preserved. Falls back to the native popups if Bootstrap is unavailable.
 */
(function () {
    'use strict';

    var ICONS = {
        info: 'bi-info-circle-fill',
        question: 'bi-question-circle-fill',
        warning: 'bi-exclamation-triangle-fill',
        danger: 'bi-exclamation-octagon-fill',
        success: 'bi-check-circle-fill'
    };

    var STYLES =
        '.cc-dialog .modal-dialog { max-width: 460px; }' +
        '.cc-dialog .modal-content { border: 0; border-radius: 14px; box-shadow: 0 12px 40px rgba(16, 24, 40, 0.18);' +
            ' font-family: "Inter", sans-serif; text-align: left; overflow: hidden; }' +
        '.cc-dialog .cc-dialog-header { display: flex; align-items: flex-start; gap: 14px; padding: 22px 22px 6px; }' +
        '.cc-dialog .cc-dialog-icon { flex: 0 0 auto; width: 42px; height: 42px; border-radius: 50%;' +
            ' display: flex; align-items: center; justify-content: center; font-size: 20px; }' +
        '.cc-dialog .cc-dialog-icon.is-info, .cc-dialog .cc-dialog-icon.is-question { background: #e7f0fd; color: #0d6efd; }' +
        '.cc-dialog .cc-dialog-icon.is-warning { background: #fff4e0; color: #d97706; }' +
        '.cc-dialog .cc-dialog-icon.is-danger { background: #fdecec; color: #dc3545; }' +
        '.cc-dialog .cc-dialog-icon.is-success { background: #e6f6ec; color: #198754; }' +
        '.cc-dialog .cc-dialog-text { flex: 1 1 auto; min-width: 0; padding-top: 2px; }' +
        '.cc-dialog .cc-dialog-title { margin: 0 0 6px; font-size: 1.05rem; font-weight: 600; color: #1f2937; }' +
        '.cc-dialog .cc-dialog-message { margin: 0; font-size: 0.925rem; line-height: 1.55; color: #4b5563;' +
            ' white-space: pre-line; overflow-wrap: anywhere; }' +
        '.cc-dialog .btn-close { flex: 0 0 auto; margin: 2px 0 0; font-size: 0.75rem; }' +
        '.cc-dialog .cc-dialog-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 18px 22px 20px; }' +
        '.cc-dialog .cc-dialog-footer .btn { min-width: 92px; border-radius: 8px; font-weight: 500; padding: 7px 16px; }' +
        '.cc-dialog .cc-dialog-cancel { background: #fff; border: 1px solid #d0d5dd; color: #344054; }' +
        '.cc-dialog .cc-dialog-cancel:hover { background: #f9fafb; border-color: #d0d5dd; color: #1f2937; }';

    var modalEl = null;
    var modal = null;
    var iconEl, iconGlyph, titleEl, messageEl, okBtn, cancelBtn;
    var okClicked = false;
    var onHidden = null;
    var queue = Promise.resolve();

    function build() {
        if (modal) return true;
        if (typeof bootstrap === 'undefined' || !document.body) return false;

        var style = document.createElement('style');
        style.textContent = STYLES;
        document.head.appendChild(style);

        modalEl = document.createElement('div');
        modalEl.className = 'modal fade cc-dialog';
        modalEl.id = 'cc-dialog-modal';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.setAttribute('aria-labelledby', 'cc-dialog-title');
        modalEl.setAttribute('aria-describedby', 'cc-dialog-message');
        modalEl.innerHTML =
            '<div class="modal-dialog modal-dialog-centered">' +
                '<div class="modal-content">' +
                    '<div class="cc-dialog-header">' +
                        '<div class="cc-dialog-icon" id="cc-dialog-icon"><i class="bi" aria-hidden="true"></i></div>' +
                        '<div class="cc-dialog-text">' +
                            '<h5 class="cc-dialog-title" id="cc-dialog-title"></h5>' +
                            '<p class="cc-dialog-message" id="cc-dialog-message"></p>' +
                        '</div>' +
                        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>' +
                    '</div>' +
                    '<div class="cc-dialog-footer">' +
                        '<button type="button" class="btn cc-dialog-cancel" data-bs-dismiss="modal" id="cc-dialog-cancel">Cancel</button>' +
                        '<button type="button" class="btn btn-primary" id="cc-dialog-ok">OK</button>' +
                    '</div>' +
                '</div>' +
            '</div>';
        document.body.appendChild(modalEl);

        iconEl = modalEl.querySelector('#cc-dialog-icon');
        iconGlyph = iconEl.querySelector('i');
        titleEl = modalEl.querySelector('#cc-dialog-title');
        messageEl = modalEl.querySelector('#cc-dialog-message');
        okBtn = modalEl.querySelector('#cc-dialog-ok');
        cancelBtn = modalEl.querySelector('#cc-dialog-cancel');
        modal = new bootstrap.Modal(modalEl);

        okBtn.addEventListener('click', function () {
            okClicked = true;
            modal.hide();
        });
        modalEl.addEventListener('shown.bs.modal', function () {
            okBtn.focus();
        });
        modalEl.addEventListener('hidden.bs.modal', function () {
            var done = onHidden;
            onHidden = null;
            if (done) done(okClicked);
        });
        return true;
    }

    function open(message, options, isConfirm) {
        var opts = options || {};
        var text = message === undefined || message === null ? '' : String(message);

        var show = function () {
            return new Promise(function (resolve) {
                if (!build()) {
                    if (isConfirm) {
                        resolve(window.confirm(text));
                    } else {
                        window.alert(text);
                        resolve();
                    }
                    return;
                }

                var variant = opts.variant || (opts.danger ? 'danger' : (isConfirm ? 'question' : 'info'));
                if (!ICONS[variant]) variant = 'info';
                iconEl.className = 'cc-dialog-icon is-' + variant;
                iconGlyph.className = 'bi ' + ICONS[variant];

                titleEl.textContent = opts.title || (isConfirm ? 'Please confirm' : 'Notice');
                messageEl.textContent = text;
                okBtn.textContent = opts.okText || 'OK';
                okBtn.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
                cancelBtn.textContent = opts.cancelText || 'Cancel';
                cancelBtn.style.display = isConfirm ? '' : 'none';

                okClicked = false;
                onHidden = function (confirmed) {
                    resolve(isConfirm ? confirmed : undefined);
                };
                modal.show();
            });
        };

        var result = queue.then(show);
        queue = result.catch(function () {});
        return result;
    }

    window.ccConfirm = function (message, options) {
        return open(message, options, true);
    };

    window.ccAlert = function (message, options) {
        return open(message, options, false);
    };
}());
