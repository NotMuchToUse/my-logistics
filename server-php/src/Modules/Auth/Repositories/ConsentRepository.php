<?php

declare(strict_types=1);

namespace App\Modules\Auth\Repositories;

use PDO;

final class ConsentRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public function recordPersonalDataProcessingConsent(
        int $userId,
        string $policyVersion,
        string $ipAddress,
        ?string $userAgent,
    ): void {
        $statement = $this->pdo->prepare(
            "INSERT INTO user_consents
                (user_id, consent_type, policy_version, is_granted, ip_address, user_agent)
             VALUES
                (:user_id, 'personal_data_processing', :policy_version, 1, :ip_address, :user_agent)"
        );
        $statement->execute([
            ':user_id' => $userId,
            ':policy_version' => $policyVersion,
            ':ip_address' => $ipAddress,
            ':user_agent' => $userAgent === null ? null : mb_substr($userAgent, 0, 500),
        ]);
    }
}
