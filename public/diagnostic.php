<?php
require_once __DIR__ . '/auth.php';

header('Content-Type: text/plain; charset=UTF-8');
header('Cache-Control: no-store');

echo 'Session status: ' . session_status() . PHP_EOL;
echo 'Session ID present: ' . (session_id() !== '' ? 'YES' : 'NO') . PHP_EOL;
echo 'Session save path: ' . (session_save_path() ?: '(default)') . PHP_EOL;

if (!isset($_SESSION['diagnostic_counter'])) {
    $_SESSION['diagnostic_counter'] = 0;
}

$_SESSION['diagnostic_counter']++;

echo 'Counter: ' . $_SESSION['diagnostic_counter'] . PHP_EOL;
