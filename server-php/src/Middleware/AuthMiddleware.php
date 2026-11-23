<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use PDO;
use RuntimeException;

final class AuthMiddleware implements MiddlewareInterface
{
    private static ?string $activeUserCondition = null;

    public function __construct(private readonly PDO $pdo)
    {
    }

    public function process(Request $request, callable $next): Response
    {
        $authorization = $request->authorization();
        if ($authorization === null || preg_match('/^Bearer\s+(\S+)$/i', trim($authorization), $matches) !== 1) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để truy cập tài nguyên này.');
        }

        $tokenHash = hash('sha256', $matches[1]);
        $activeUserCondition = self::activeUserCondition($this->pdo);
        $statement = $this->pdo->prepare(
            'SELECT pat.id AS token_id, pat.user_id,
                    u.public_id, u.full_name, u.must_change_password
             FROM personal_access_tokens pat
             INNER JOIN users u ON u.id = pat.user_id
             WHERE pat.token_hash = :token_hash
               AND pat.revoked_at IS NULL
               AND pat.expires_at > NOW()
               AND u.deleted_at IS NULL
               AND ' . $activeUserCondition . '
             LIMIT 1'
        );
        $statement->execute([':token_hash' => $tokenHash]);
        $session = $statement->fetch(PDO::FETCH_ASSOC);

        if ($session === false) {
            throw new ApiException('401_UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn.');
        }

        $session['user_id'] = (int) $session['user_id'];
        $session['token_id'] = (int) $session['token_id'];
        $session['must_change_password'] = (int) $session['must_change_password'];
        $request->setAttribute('auth', $session);

        return $next($request);
    }

    private static function activeUserCondition(PDO $pdo): string
    {
        if (self::$activeUserCondition !== null) {
            return self::$activeUserCondition;
        }

        $statement = $pdo->prepare('SHOW COLUMNS FROM users');
        $statement->execute();
        $columnNames = array_column($statement->fetchAll(PDO::FETCH_ASSOC), 'Field');

        if (in_array('status', $columnNames, true)) {
            self::$activeUserCondition = "u.status = 'active'";
        } elseif (in_array('is_active', $columnNames, true)) {
            self::$activeUserCondition = 'u.is_active = 1';
        } else {
            throw new RuntimeException('The users table has no supported active-state column.');
        }

        return self::$activeUserCondition;
    }
}
