<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\ApiException;
use App\Core\Request;
use App\Core\Response;
use PDO;

final class PermissionMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly string $permissionCode,
    ) {
    }

    public function process(Request $request, callable $next): Response
    {
        $auth = $request->attribute('auth');
        if (!is_array($auth) || !isset($auth['user_id'])) {
            throw new ApiException('401_UNAUTHORIZED', 'Cần đăng nhập để kiểm tra quyền truy cập.');
        }

        if ($this->permissionCode === '') {
            throw new ApiException('500_INTERNAL_ERROR', 'Mã quyền của route chưa được cấu hình.');
        }

        $statement = $this->pdo->prepare(
            'SELECT 1
             FROM user_has_roles uhr
             INNER JOIN role_has_permissions rhp ON rhp.role_id = uhr.role_id
             INNER JOIN permissions p ON p.id = rhp.permission_id
             WHERE uhr.user_id = :user_id
               AND p.code = :permission_code
             LIMIT 1'
        );
        $statement->execute([
            ':user_id' => (int) $auth['user_id'],
            ':permission_code' => $this->permissionCode,
        ]);

        if ($statement->fetchColumn() === false) {
            throw new ApiException('403_FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.');
        }

        return $next($request);
    }
}
