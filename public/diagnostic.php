<?php
header('Content-Type: text/plain; charset=UTF-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/auth.php';

echo "SESSION DIAGNOSTIC\n";
echo "Session name: " . session_name() . "\n";
echo "Session status: " . session_status() . "\n";
echo "Session ID present: " . (session_id() !== '' ? 'YES' : 'NO') . "\n";
echo "Session cookie received: " .
    (isset($_COOKIE['GOAT_WORKSPACE']) ? 'YES' : 'NO') . "\n";
echo "Raw cookie header contains session name: " .
    (strpos($_SERVER['HTTP_COOKIE'] ?? '', 'GOAT_WORKSPACE=') !== false
        ? 'YES' : 'NO') . "\n";
echo "Session save handler: " . ini_get('session.save_handler') . "\n";
echo "Session save path: " .
    (session_save_path() ?: '(default)') . "\n";
echo "CSRF stored: " .
    (!empty($_SESSION['csrf']) ? 'YES' : 'NO') . "\n";
