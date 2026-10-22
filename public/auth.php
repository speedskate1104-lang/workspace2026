<?php
declare(strict_types=1);

const AUTH_FILE = '/home/users/0/perma.jp-goat-music/workspace-auth/password.hash';

const SESSION_ERROR_LOG = '/home/users/0/perma.jp-goat-music/workspace-auth/session-error.log';

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');

session_name('GOAT_WORKSPACE');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Lax',
]);

if (session_status() !== PHP_SESSION_ACTIVE) {
    $sessionError = null;

    set_error_handler(
        function (int $severity, string $message) use (&$sessionError): bool {
            $sessionError = $message;
            return true;
        }
    );

    try {
        $started = session_start();
    } finally {
        restore_error_handler();
    }

    if (!$started) {
        $message = date('c')
            . ' GOAT Workspace session_start failed: '
            . ($sessionError ?? 'Unknown error')
            . PHP_EOL;

        error_log(
            $message,
            3,
            SESSION_ERROR_LOG
        );

        http_response_code(500);
        exit('Session initialization failed. Check server error log.');
    }
}

function authenticated(): bool {
    return ($_SESSION['authenticated'] ?? false) === true;
}

function require_login(): void {
    if (!authenticated()) {
        header('Location: /login.php');
        exit;
    }
}

function csrf_token(): string {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }

    return $_SESSION['csrf'];
}

function valid_csrf(?string $token): bool {
    if (!is_string($token)) {
        return false;
    }

    $stored = $_SESSION['csrf'] ?? null;

    return is_string($stored)
        && hash_equals($stored, $token);
}
