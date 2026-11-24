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
    private ?string $activeUserCondition = null;

    private ?bool $tokenLastUsedAtColumnExists = null;

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
        $activeUserCondition = $this->activeUserCondition();
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
        $session['roles'] = $this->roleCodes($session['user_id']);
        $session['permissions'] = $this->permissionCodes($session['user_id']);
        $this->updateLastUsedAt($session['token_id']);
        $request->setAttribute('auth', $session);

        if (
            $session['must_change_password'] === 1
            && !in_array($request->path(), [
                '/api/v1/auth/me',
                '/api/v1/auth/change-password',
                '/api/v1/auth/logout',
            ], true)
        ) {
            throw new ApiException(
                '403_FORBIDDEN',
                'Tài khoản bắt buộc đổi mật khẩu lần đầu trước khi thao tác',
                [],
                403,
            );
        }

        return $next($request);
    }

    /**
     * @return list<string>
     */
    private function roleCodes(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT DISTINCT r.code
             FROM user_has_roles uhr
             INNER JOIN roles r ON r.id = uhr.role_id
             WHERE uhr.user_id = :user_id
             ORDER BY r.code'
        );
        $statement->execute([':user_id' => $userId]);

        return array_values(array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN)));
    }

    /**
     * @return list<string>
     */
    private function permissionCodes(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT DISTINCT p.code
             FROM user_has_roles uhr
             INNER JOIN role_has_permissions rhp ON rhp.role_id = uhr.role_id
             INNER JOIN permissions p ON p.id = rhp.permission_id
             WHERE uhr.user_id = :user_id
             ORDER BY p.code'
        );
        $statement->execute([':user_id' => $userId]);

        return array_values(array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN)));
    }

    private function updateLastUsedAt(int $tokenId): void
    {
        if ($this->tokenLastUsedAtColumnExists === null) {
            $statement = $this->pdo->query('SHOW COLUMNS FROM personal_access_tokens');
            $columns = array_column($statement->fetchAll(PDO::FETCH_ASSOC), 'Field');
            $this->tokenLastUsedAtColumnExists = in_array('last_used_at', $columns, true);
        }

        if (!$this->tokenLastUsedAtColumnExists) {
            return;
        }

        $statement = $this->pdo->prepare(
            'UPDATE personal_access_tokens SET last_used_at = NOW() WHERE id = :token_id'
        );
        $statement->execute([':token_id' => $tokenId]);
    }

    private function activeUserCondition(): string
    {
        if ($this->activeUserCondition !== null) {
            return $this->activeUserCondition;
        }

        $statement = $this->pdo->query('SHOW COLUMNS FROM users');
        $columnNames = array_column($statement->fetchAll(PDO::FETCH_ASSOC), 'Field');

        if (in_array('status', $columnNames, true)) {
            $this->activeUserCondition = "u.status = 'active'";
        } elseif (in_array('is_active', $columnNames, true)) {
            $this->activeUserCondition = 'u.is_active = 1';
        } else {
            throw new RuntimeException('The users table has no supported active-state column.');
        }

        return $this->activeUserCondition;
    }
}
