<?php

declare(strict_types=1);

use App\Core\ApiException;
use App\Core\Database;
use App\Core\Request;
use App\Core\Router;
use App\Middleware\CorsMiddleware;
use Dotenv\Dotenv;

$projectRoot = dirname(__DIR__);
require $projectRoot . '/vendor/autoload.php';
Dotenv::createImmutable($projectRoot)->safeLoad();

/**
 * @param array<string, mixed> $body
 * @param array<string, string> $headers
 * @return array{status: int, payload: array<string, mixed>}
 */
function dispatchAuthRequest(
    Router $router,
    string $method,
    string $path,
    array $body = [],
    array $headers = [],
): array {
    $rawBody = $body === []
        ? ''
        : json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $requestHeaders = [
        'Accept' => 'application/json',
        'Content-Type' => 'application/json',
        'X-Client-Type' => 'web_public',
        ...$headers,
    ];
    $request = new Request(
        $method,
        $path,
        [],
        $rawBody,
        [],
        $requestHeaders,
        '198.51.100.' . random_int(1, 254),
        'AuthModuleTest/1.0',
    );
    $response = $router->dispatch($request);
    $decoded = json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($decoded)) {
        throw new RuntimeException('API returned a non-object JSON payload.');
    }

    return [
        'status' => $response->statusCode(),
        'payload' => $decoded,
    ];
}

function assertAuthTest(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function createAuthTestUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);

    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12),
    );
}

try {
    $pdo = Database::getConnection();
    $pdo->beginTransaction();

    $router = new Router();
    $router->use(new CorsMiddleware(require $projectRoot . '/config/cors.php'));
    $registerAuthRoutes = require $projectRoot . '/src/Modules/Auth/routes.php';
    $registerAuthRoutes($router);

    $email = 'auth-test-' . bin2hex(random_bytes(6)) . '@example.test';
    $phone = '09' . (string) random_int(10000000, 99999999);
    $password = 'AuthTestPasswordA1!';
    $newPassword = 'AuthTestPasswordB2!';
    $idempotencyKey = createAuthTestUuid();
    $registerBody = [
        'full_name' => 'Auth integration test',
        'email' => $email,
        'phone' => $phone,
        'password' => $password,
        'customer_type' => 'individual',
        'accepted_privacy_policy' => true,
    ];
    $registerHeaders = [
        'Idempotency-Key' => $idempotencyKey,
    ];
    $registered = dispatchAuthRequest(
        $router,
        'POST',
        '/api/v1/auth/register',
        $registerBody,
        $registerHeaders,
    );
    assertAuthTest($registered['status'] === 201, 'Registration did not return HTTP 201.');
    assertAuthTest($registered['payload']['success'] === true, 'Registration envelope was unsuccessful.');
    $registrationData = $registered['payload']['data'] ?? null;
    assertAuthTest(is_array($registrationData), 'Registration response data is missing.');
    assertAuthTest(
        is_string($registrationData['access_token'] ?? null),
        'Registration response did not contain an access token.',
    );
    assertAuthTest(
        !array_key_exists('id', $registrationData['user'] ?? []),
        'Registration response exposed an internal user ID.',
    );
    $registrationJson = json_encode($registered['payload'], JSON_THROW_ON_ERROR);
    foreach (['password_hash', 'token_hash', 'phone_hash', 'phone_encrypted'] as $sensitiveKey) {
        assertAuthTest(
            !str_contains($registrationJson, $sensitiveKey),
            'Registration response exposed sensitive field ' . $sensitiveKey . '.',
        );
    }

    $replayedRegistration = dispatchAuthRequest(
        $router,
        'POST',
        '/api/v1/auth/register',
        $registerBody,
        $registerHeaders,
    );
    assertAuthTest($replayedRegistration['status'] === 201, 'Registration replay status changed.');
    assertAuthTest(
        $replayedRegistration['payload']['data']['access_token'] === $registrationData['access_token'],
        'Idempotent registration did not replay the original response.',
    );

    $login = dispatchAuthRequest($router, 'POST', '/api/v1/auth/login', [
        'email' => $email,
        'password' => $password,
    ]);
    assertAuthTest($login['status'] === 200, 'Login did not return HTTP 200.');
    $loginData = $login['payload']['data'] ?? null;
    assertAuthTest(is_array($loginData) && is_string($loginData['access_token'] ?? null), 'Login token is missing.');
    try {
        dispatchAuthRequest($router, 'POST', '/api/v1/auth/login', [
            'identifier' => $email,
            'password' => $password,
        ], [
            'X-Client-Type' => 'web_internal',
        ]);
        throw new RuntimeException('A customer was allowed to sign in through web_internal.');
    } catch (ApiException $exception) {
        assertAuthTest(
            $exception->errorCode === '403_FORBIDDEN',
            'A wrong-channel login returned the wrong API error code.',
        );
    }

    $userIdStatement = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $userIdStatement->execute([':email' => $email]);
    $userId = $userIdStatement->fetchColumn();
    assertAuthTest($userId !== false, 'Test user was not persisted during registration.');
    $setMustChangePassword = $pdo->prepare(
        'UPDATE users SET must_change_password = 1 WHERE id = :user_id'
    );
    $setMustChangePassword->execute([':user_id' => (int) $userId]);

    $authorization = ['Authorization' => 'Bearer ' . $loginData['access_token']];
    $changedPassword = dispatchAuthRequest(
        $router,
        'POST',
        '/api/v1/auth/change-password',
        [
            'current_password' => $password,
            'new_password' => $newPassword,
            'new_password_confirmation' => $newPassword,
        ],
        $authorization,
    );
    assertAuthTest($changedPassword['status'] === 200, 'Change-password did not return HTTP 200.');

    $session = dispatchAuthRequest($router, 'GET', '/api/v1/auth/me', [], $authorization);
    assertAuthTest($session['status'] === 200, 'The authenticated /me request failed.');
    assertAuthTest(
        $session['payload']['data']['user']['must_change_password'] === false,
        'Changing the password did not clear must_change_password.',
    );

    $logout = dispatchAuthRequest($router, 'POST', '/api/v1/auth/logout', [], $authorization);
    assertAuthTest($logout['status'] === 200, 'Logout did not return HTTP 200.');
    try {
        dispatchAuthRequest($router, 'GET', '/api/v1/auth/me', [], $authorization);
        throw new RuntimeException('The revoked token was accepted by /me.');
    } catch (ApiException $exception) {
        assertAuthTest(
            $exception->errorCode === '401_UNAUTHORIZED',
            'A revoked token returned the wrong API error code.',
        );
    }

    for ($attempt = 1; $attempt <= 5; $attempt++) {
        try {
            dispatchAuthRequest($router, 'POST', '/api/v1/auth/login', [
                'identifier' => $email,
                'password' => 'IncorrectPasswordA1!',
            ]);
            throw new RuntimeException('An incorrect password was accepted.');
        } catch (ApiException $exception) {
            $expectedCode = $attempt === 5 ? '429_TOO_MANY_REQUESTS' : '401_UNAUTHORIZED';
            assertAuthTest(
                $exception->errorCode === $expectedCode,
                'Unexpected brute-force response on attempt ' . $attempt . '.',
            );
        }
    }

    $pdo->rollBack();
    echo "Auth integration checks passed: register, idempotent replay, login, 5-attempt lockout, change password, logout, revoked-token rejection." . PHP_EOL;
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    fwrite(STDERR, 'Auth integration test failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
