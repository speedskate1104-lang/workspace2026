
<?php
require_once __DIR__ . '/auth.php';

if (authenticated()) {
    header('Location: /');
    exit;
}

$error = '';
$now = time();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // CSRF診断（原因特定後に通常処理へ戻す）
    if (!valid_csrf($_POST['csrf'] ?? null)) {
        http_response_code(400);
        header('Content-Type: text/plain; charset=UTF-8');
        header('Cache-Control: no-store');

        $submitted = $_POST['csrf'] ?? null;
        $stored = $_SESSION['csrf'] ?? null;

        echo 'Submitted: ' .
            (is_string($submitted) && $submitted !== '' ? 'YES' : 'NO') . "\n";

        echo 'Stored: ' .
            (is_string($stored) && $stored !== '' ? 'YES' : 'NO') . "\n";

        echo 'Match: ' . (
            is_string($submitted) &&
            is_string($stored) &&
            hash_equals($stored, $submitted)
                ? 'YES' : 'NO'
        ) . "\n";

        exit;
    }

    $attempts = $_SESSION['login_attempts'] ?? [];

    $attempts = array_values(array_filter(
        $attempts,
        fn($time) => $time > $now - 900
    ));

    if (count($attempts) >= 5) {
        $error = 'しばらく時間を置いてください。';
    } else {
        $password = (string)($_POST['password'] ?? '');

        $hash = is_readable(AUTH_FILE)
            ? trim(file_get_contents(AUTH_FILE))
            : '';

        if ($hash !== '' && password_verify($password, $hash)) {
            session_regenerate_id(true);

            $_SESSION['authenticated'] = true;
            $_SESSION['login_attempts'] = [];

            header('Location: /');
            exit;
        }

        $attempts[] = $now;
        $_SESSION['login_attempts'] = $attempts;

        $error = 'パスワードが正しくありません。';
    }
}
?>
<!doctype html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Login | GOAT Workspace</title>
    <link rel="stylesheet" href="/assets/style.css">
</head>
<body class="login-page">

<form class="login-box" method="post">
    <div class="eyebrow">GOAT MUSIC PRODUCTION</div>

    <h1>Workspace</h1>
    <p>Private Dashboard</p>

    <?php if ($error): ?>
        <div class="error">
            <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
        </div>
    <?php endif; ?>

    <input
        type="hidden"
        name="csrf"
        value="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>"
    >

    <input
        type="password"
        name="password"
        placeholder="Password"
        required
        autofocus
    >

    <button type="submit">Sign in</button>
</form>

</body>
</html>
