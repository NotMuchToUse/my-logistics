<?php

declare(strict_types=1);

$configuredOrigins = $_ENV['CORS_ALLOWED_ORIGINS'] ?? $_SERVER['CORS_ALLOWED_ORIGINS'] ?? '';
$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $configuredOrigins))));

return [
    'allowed_origins' => $allowedOrigins,
    'allowed_client_types' => ['web_public', 'web_internal', 'mobile_driver'],
];
