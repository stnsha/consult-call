<?php
// Get current page to highlight active nav item
$current_page = basename($_SERVER['PHP_SELF']);
$current_dir = basename(dirname($_SERVER['PHP_SELF']));

// Determine active class for each nav item
$dashboard_active = ($current_page == 'index.php' && $current_dir == 'consultcall') ? 'active' : '';
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
                    <a class="nav-link <?php echo $dashboard_active; ?>" href="consultcall/index.php">Telehealth Dashboard</a>
                </li>
            </ul>
        </div>
    </div>
</nav>
