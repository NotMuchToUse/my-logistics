<?php

declare(strict_types=1);

namespace App\Modules\Auth\Repositories;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class TokenRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function create(
        int $userId,
        string $plainToken,
        string $clientType,
        ?string $ipAddress,
        ?string $userAgent,
        int $ttlHours,
    ): string {
        $deviceType = match ($clientType) {
            'web_public' => 'web_customer',
            'web_internal' => 'web_internal',
            'mobile_driver' => 'mobile_driver',
            default => throw new \InvalidArgumentException('Unsupported client type.'),
        };
        $expiresAt = (new DateTimeImmutable('now', new DateTimeZone('+07:00')))
            ->modify('+' . max(1, $ttlHours) . ' hours');
        $statement = $this->pdo->prepare(
            'INSERT INTO personal_access_tokens
                (user_id, token_name, token_hash, device_type, ip_address, user_agent, expires_at)
             VALUES
                (:user_id, :token_name, :token_hash, :device_type, :ip_address, :user_agent, :expires_at)'
        );
        $statement->execute([
            ':user_id' => $userId,
            ':token_name' => $deviceType,
            ':token_hash' => hash('sha256', $plainToken),
            ':device_type' => $deviceType,
            ':ip_address' => $ipAddress,
            ':user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 500),
            ':expires_at' => $expiresAt->format('Y-m-d H:i:s'),
        ]);

        return $expiresAt->format(DATE_ATOM);
    }

    public function revokeOtherUserTokens(int $userId, int $currentTokenId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE personal_access_tokens
             SET revoked_at = NOW()
             WHERE user_id = :user_id
               AND id <> :current_token_id
               AND revoked_at IS NULL'
        );
        $statement->execute([
            ':user_id' => $userId,
            ':current_token_id' => $currentTokenId,
        ]);
    }

    public function revokeById(int $tokenId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE personal_access_tokens
             SET revoked_at = NOW()
             WHERE id = :token_id
               AND revoked_at IS NULL'
        );
        $statement->execute([':token_id' => $tokenId]);
    }
}
