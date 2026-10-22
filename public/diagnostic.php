
<?php
declare(strict_types=1);

header('Content-Type: text/plain; charset=UTF-8');

echo "STEP 1: PHP works\n";
echo "PHP version: " . PHP_VERSION . "\n";

echo "STEP 2: Loading auth.php\n";

require_once __DIR__ . '/auth.php';

echo "STEP 3: auth.php loaded\n";

echo "STEP 4: Session status = ";
echo session_status() . "\n";

echo "STEP 5: Diagnostic completed\n";
