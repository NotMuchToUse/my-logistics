<?php

declare(strict_types=1);

return [
    'host' => $_ENV['DB_HOST'] ?? $_SERVER['DB_HOST'] ?? '127.0.0.1',
    'port' => (int) ($_ENV['DB_PORT'] ?? $_SERVER['DB_PORT'] ?? 3306),
    'database' => $_ENV['DB_DATABASE'] ?? $_SERVER['DB_DATABASE'] ?? '',
    'username' => $_ENV['DB_USERNAME'] ?? $_SERVER['DB_USERNAME'] ?? '',
    'password' => $_ENV['DB_PASSWORD'] ?? $_SERVER['DB_PASSWORD'] ?? '',
    'charset' => 'utf8mb4',
];
