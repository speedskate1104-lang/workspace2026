<?php
require_once __DIR__ . '/auth.php';
require_login();

$tools = json_decode(
    file_get_contents(__DIR__ . '/data/tools.json'),
    true
) ?: [];

$categories = [];
foreach ($tools as $tool) {
    $categories[$tool['category']][] = $tool;
}
?>
<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GOAT Workspace</title>
<link rel="stylesheet" href="/assets/style.css">
</head>
<body>
<div class="layout">
    <aside class="sidebar">
        <div class="brand">GOAT <span>WORKSPACE</span></div>
        <nav>
            <a href="/" class="active">⌂ &nbsp; Dashboard</a>
            <?php foreach (array_keys($categories) as $category): ?>
                <a href="#<?= urlencode($category) ?>">
                    <?= htmlspecialchars($category) ?>
                </a>
            <?php endforeach; ?>
        </nav>
        <form action="/logout.php" method="post" class="logout">
            <input type="hidden" name="csrf"
                   value="<?= htmlspecialchars(csrf_token()) ?>">
            <button>Sign out</button>
        </form>
    </aside>

    <main class="main">
        <header>
            <div>
                <div class="eyebrow">GOAT MUSIC PRODUCTION</div>
                <h1>Workspace</h1>
                <p>Your private tools & applications.</p>
            </div>
            <span class="status">● Private</span>
        </header>

        <input id="search" class="search"
               placeholder="Search applications...">

        <?php foreach ($categories as $category => $items): ?>
            <section id="<?= htmlspecialchars($category) ?>">
                <h2><?= htmlspecialchars($category) ?></h2>
                <div class="cards">
                    <?php foreach ($items as $tool): ?>
                        <a class="tool-card"
                           href="<?= htmlspecialchars($tool['url']) ?>">
                            <div class="tool-icon">
                                <?= htmlspecialchars($tool['icon']) ?>
                            </div>
                            <div>
                                <strong><?= htmlspecialchars($tool['name']) ?></strong>
                                <p><?= htmlspecialchars($tool['description']) ?></p>
                            </div>
                            <span class="arrow">↗</span>
                        </a>
                    <?php endforeach; ?>
                </div>
            </section>
        <?php endforeach; ?>

        <footer>GOAT MUSIC PRODUCTION © 2026</footer>
    </main>
</div>
<script>
document.getElementById('search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.tool-card').forEach(card => {
        card.hidden = !card.textContent.toLowerCase().includes(q);
    });
});
</script>
</body>
</html>
