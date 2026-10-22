
<?php
header('Content-Type: text/plain; charset=UTF-8');

echo "STEP 1: PHP OK\n";
echo "PHP Version: " . PHP_VERSION . "\n";

echo "STEP 2: Loading auth.php\n";

require_once __DIR__ . '/auth.php';

echo "STEP 3: AUTH OK\n";
echo "Session Status: " . session_status() . "\n";
