
<?php
require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST'
    || !valid_csrf($_POST['csrf'] ?? null)) {
    http_response_code(403);
    exit('Forbidden');
}

$_SESSION = [];
session_destroy();

header('Location: /login.php');
exit;
