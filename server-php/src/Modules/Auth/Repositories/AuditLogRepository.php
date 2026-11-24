<?php

declare(strict_types=1);

namespace App\Modules\Auth\Repositories;

use PDO;
use JsonException;

final class AuditLogRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function recordPasswordChange(
        int $userId,
        ?string $ipAddress,
        ?string $userAgent,
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO audit_logs
                (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
             VALUES
                (:user_id, :action, :table_name, :record_id, :old_values, :new_values, :ip_address, :user_agent)'
        );

        try {
            $newValues = json_encode(
                ['password_changed' => true],
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
            );
        } catch (JsonException $exception) {
            throw new \RuntimeException('Unable to serialize audit data.', 0, $exception);
        }

        $statement->execute([
            ':user_id' => $userId,
            ':action' => 'CHANGE_PASSWORD',
            ':table_name' => 'users',
            ':record_id' => $userId,
            ':old_values' => null,
            ':new_values' => $newValues,
            ':ip_address' => $ipAddress ?? '0.0.0.0',
            ':user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 500),
        ]);
    }
}
