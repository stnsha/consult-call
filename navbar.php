<?php
// Dev role switcher toolbar (localhost only)
$_navbar_serverName = isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : '';
$_navbar_httpHost   = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
$_navbar_isLocal    = in_array($_navbar_serverName, array('localhost', '127.0.0.1'))
    || strpos($_navbar_serverName, 'localhost') !== false
    || strpos($_navbar_httpHost, 'localhost') !== false
    || strpos($_navbar_httpHost, '127.0.0.1') !== false;

if ($_navbar_isLocal) {
    if (session_id() == '') {
        session_start();
    }

    $_navbar_roleLabels = array(
        0 => 'Normal User',
        1 => 'Super Admin',
        2 => 'Doctor',
        3 => 'Pharmacy',
        4 => 'HQ',
        5 => 'Outlet',
    );

    $_navbar_activeRole      = isset($_SESSION['dev_role_override']) ? (int)$_SESSION['dev_role_override'] : null;
    $_navbar_activeRoleLabel = ($_navbar_activeRole !== null)
        ? $_navbar_roleLabels[$_navbar_activeRole]
        : 'DB Default';
    $_navbar_currentUri      = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/odb/consultcall/index.php';
?>
<div style="background:#12122a;color:#d0d0f0;padding:5px 14px;font-size:11px;font-family:monospace;display:flex;align-items:center;gap:10px;flex-wrap:wrap;border-bottom:1px solid #333;">
    <span style="color:#888;letter-spacing:.05em;">DEV ROLE</span>
    <strong style="color:#f0c040;">[<?php echo htmlspecialchars($_navbar_activeRoleLabel); ?>]</strong>
    <?php foreach ($_navbar_roleLabels as $_r => $_label): ?>
        <form method="POST" action="/odb/consultcall/dev-switch-role.php" style="display:inline;margin:0;">
            <input type="hidden" name="role" value="<?php echo $_r; ?>">
            <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($_navbar_currentUri); ?>">
            <button type="submit" style="background:<?php echo ($_navbar_activeRole === $_r ? '#2e2e6e' : '#1e1e3e'); ?>;color:<?php echo ($_navbar_activeRole === $_r ? '#f0c040' : '#aaa'); ?>;border:1px solid <?php echo ($_navbar_activeRole === $_r ? '#555' : '#333'); ?>;padding:2px 7px;font-size:11px;cursor:pointer;border-radius:3px;font-family:monospace;"><?php echo $_r; ?>: <?php echo $_label; ?></button>
        </form>
    <?php endforeach; ?>
    <?php if ($_navbar_activeRole !== null): ?>
        <form method="POST" action="/odb/consultcall/dev-switch-role.php" style="display:inline;margin:0;">
            <input type="hidden" name="role" value="clear">
            <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($_navbar_currentUri); ?>">
            <button type="submit" style="background:#3a1010;color:#ff8888;border:1px solid #a44;padding:2px 7px;font-size:11px;cursor:pointer;border-radius:3px;font-family:monospace;">Clear Override</button>
        </form>
    <?php endif; ?>
</div>
<?php } ?>

<?php
// Get current page to highlight active nav item
$current_page = basename($_SERVER['PHP_SELF']);
$current_dir = basename(dirname($_SERVER['PHP_SELF']));

// Determine active class for each nav item
$dashboard_active = ($current_page == 'index.php' && $current_dir == 'consultcall') ? 'active' : '';
$report_active = ($current_page == 'report.php' && $current_dir == 'consultcall') ? 'active' : '';
?>
<nav class="consultcall-nav navbar navbar-expand-lg navbar-light mb-3">
    <div class="container-fluid">
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav"
            aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <i class="bi bi-list"></i>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
            <ul class="navbar-nav">
                <li class="nav-item">
                    <a class="nav-link <?php echo $dashboard_active; ?>" href="consultcall/index.php">Dashboard</a>
                </li>
                <li class="nav-item">
                    <a class="nav-link <?php echo $report_active; ?>" href="consultcall/report.php">Report</a>
                </li>
            </ul>
        </div>
    </div>
</nav>
