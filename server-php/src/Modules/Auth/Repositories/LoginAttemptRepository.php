<?php

declare(strict_types=1);

namespace App\Modules\Auth\Repositories;

use PDO;

final class LoginAttemptRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function countRecentFailures(string $identifier, string $ipAddress): int
    {
        $statement = $this->pdo->prepare(
            'SELECT COUNT(*)
             FROM login_attempts
             WHERE is_successful = 0
               AND attempted_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
               AND (identifier = :identifier OR ip_address = :ip_address)'
        );
        $statement->execute([
            ':identifier' => $identifier,
            ':ip_address' => $ipAddress,
        ]);

        return (int) $statement->fetchColumn();
    }

    public function record(
        string $identifier,
        string $ipAddress,
        ?string $userAgent,
        bool $successful,
        ?string $failureReason = null,
    ): void {
        $statement = $this->pdo->prepare(
            'INSERT INTO login_attempts
                (identifier, ip_address, user_agent, is_successful, failure_reason)
             VALUES
                (:identifier, :ip_address, :user_agent, :is_successful, :failure_reason)'
        );
        $statement->execute([
            ':identifier' => mb_substr($identifier, 0, 150),
            ':ip_address' => $ipAddress,
            ':user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 500),
            ':is_successful' => $successful ? 1 : 0,
            ':failure_reason' => $failureReason,
        ]);
    }
}
