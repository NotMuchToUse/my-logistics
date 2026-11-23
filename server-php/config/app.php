<?php

declare(strict_types=1);

return [
    'env' => $_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? 'production',
    'debug' => filter_var($_ENV['APP_DEBUG'] ?? $_SERVER['APP_DEBUG'] ?? false, FILTER_VALIDATE_BOOL),
    'timezone' => '+07:00',
];
