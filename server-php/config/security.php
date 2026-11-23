<?php

declare(strict_types=1);

return [
    'app_key' => $_ENV['APP_KEY'] ?? $_SERVER['APP_KEY'] ?? '',
    'pii_hash_key' => $_ENV['PII_HASH_KEY'] ?? $_SERVER['PII_HASH_KEY'] ?? '',
    'token_ttl_hours' => 24,
    'login_attempt_limit' => 5,
    'login_attempt_window_minutes' => 15,
];
