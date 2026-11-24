<?php

declare(strict_types=1);

namespace App\Modules\Auth\Services;

use App\Core\ApiException;
use App\Core\Crypto;
use App\Core\Database;
use App\Core\UlidGenerator;
use App\Modules\Auth\DTOs\ChangePasswordDto;
use App\Modules\Auth\DTOs\LoginDto;
use App\Modules\Auth\DTOs\RegisterCustomerDto;
use App\Modules\Auth\Repositories\AuditLogRepository;
use App\Modules\Auth\Repositories\AuthUserRepository;
use App\Modules\Auth\Repositories\ConsentRepository;
use App\Modules\Auth\Repositories\LoginAttemptRepository;
use App\Modules\Auth\Repositories\TokenRepository;
use PDO;
use PDOException;

final class AuthService
{
    private const MAX_LOGIN_FAILURES = 5;
    private const RATE_LIMIT_MESSAGE = 'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần.';

    /**
     * @param array<string, mixed> $securityConfig
     */
    public function __construct(
        private readonly PDO $pdo,
        private readonly AuthUserRepository $users,
        private readonly TokenRepository $tokens,
        private readonly LoginAttemptRepository $loginAttempts,
        private readonly ConsentRepository $consents,
        private readonly AuditLogRepository $auditLogs,
        private readonly array $securityConfig,
    ) {
    }

    /**
     * @param array<string, mixed>|null $idempotency
     * @return array<string, mixed>
     */
    public function register(
        RegisterCustomerDto $dto,
        ?string $ipAddress,
        ?string $userAgent,
        ?array $idempotency = null,
        ?array $idempotencyRecovery = null,
    ): array {
        if ($ipAddress === null || filter_var($ipAddress, FILTER_VALIDATE_IP) === false) {
            throw new ApiException('400_BAD_REQUEST', 'Không xác định được địa chỉ IP của request.');
        }

        $phoneHash = Crypto::hashPhone($dto->phone);
        if ($idempotencyRecovery !== null) {
            return $this->recoverRegistration(
                $dto,
                $phoneHash,
                $ipAddress,
                $userAgent,
                $idempotencyRecovery,
            );
        }

        $this->assertRegistrationIdentityAvailable($dto->email, $phoneHash);
        $roleCode = $dto->customer_type === 'corporate_postpaid'
            ? 'customer_corporate'
            : 'customer_individual';
        $roleId = $this->users->roleIdForCode($roleCode);
        $passwordHash = $this->hashPassword($dto->password);
        $phoneEncrypted = Crypto::encrypt($dto->phone);
        $phoneMasked = Crypto::maskPhone($dto->phone);

        try {
            $result = Database::transaction(function (PDO $pdo) use (
                $dto,
                $ipAddress,
                $userAgent,
                $phoneHash,
                $phoneEncrypted,
                $phoneMasked,
                $passwordHash,
                $roleId,
                $idempotency,
            ): array {
                $this->assertRegistrationIdentityAvailable($dto->email, $phoneHash);
                $userPublicId = UlidGenerator::generate();
                $userId = $this->users->createUser([
                    'public_id' => $userPublicId,
                    'full_name' => $dto->full_name,
                    'email' => $dto->email,
                    'phone_encrypted' => $phoneEncrypted,
                    'phone_hash' => $phoneHash,
                    'phone_masked' => $phoneMasked,
                    'password_hash' => $passwordHash,
                    'user_type' => 'customer',
                    'must_change_password' => 0,
                    'is_active' => 1,
                ]);
                $this->users->assignRole($userId, $roleId);

                $customerCode = $this->generateCustomerCode();
                $customerPublicId = UlidGenerator::generate();
                $this->users->createCustomer([
                    'public_id' => $customerPublicId,
                    'user_id' => $userId,
                    'customer_code' => $customerCode,
                    'customer_type' => $dto->customer_type,
                    'company_name' => $dto->company_name,
                    'tax_code' => $dto->tax_code,
                    'full_name' => $dto->full_name,
                    'phone_encrypted' => $phoneEncrypted,
                    'phone_hash' => $phoneHash,
                    'phone_masked' => $phoneMasked,
                    'email' => $dto->email,
                ]);

                $this->consents->recordPersonalDataProcessingConsent(
                    $userId,
                    $dto->policy_version,
                    $ipAddress,
                    $userAgent,
                );

                $plainToken = bin2hex(random_bytes(32));
                $expiresAt = $this->tokens->create(
                    $userId,
                    $plainToken,
                    'web_public',
                    $ipAddress,
                    $userAgent,
                    (int) ($this->securityConfig['token_ttl_hours'] ?? 24),
                );
                $idempotencyRecordId = null;
                if ($idempotency !== null) {
                    $idempotencyRecordId = $this->users->createRegistrationIdempotency(
                        $userId,
                        (string) $idempotency['idempotency_key'],
                        (string) $idempotency['endpoint'],
                        (string) $idempotency['request_hash'],
                    );
                }

                return [
                    'access_token' => $plainToken,
                    'token_type' => 'Bearer',
                    'expires_at' => $expiresAt,
                    'user' => [
                        'public_id' => $userPublicId,
                        'full_name' => $dto->full_name,
                        'email' => $dto->email,
                        'phone_masked' => $phoneMasked,
                        'user_type' => 'customer',
                        'must_change_password' => false,
                    ],
                    'customer' => [
                        'public_id' => $customerPublicId,
                        'customer_code' => $customerCode,
                        'customer_type' => $dto->customer_type,
                    ],
                    '_idempotency_record_id' => $idempotencyRecordId,
                ];
            });
        } catch (PDOException $exception) {
            if ((string) $exception->getCode() === '23000') {
                throw new ApiException(
                    '422_VALIDATION_ERROR',
                    'Email hoặc số điện thoại đã được đăng ký.',
                    [
                        'email' => ['Email hoặc số điện thoại đã tồn tại.'],
                        'phone' => ['Email hoặc số điện thoại đã tồn tại.'],
                    ],
                    previous: $exception,
                );
            }

            throw $exception;
        }

        return $result;
    }

    /**
     * @return array<string, mixed>
     */
    public function login(
        LoginDto $dto,
        string $clientType,
        ?string $ipAddress,
        ?string $userAgent,
    ): array {
        $this->assertClientType($clientType);
        if ($ipAddress === null || filter_var($ipAddress, FILTER_VALIDATE_IP) === false) {
            throw new ApiException('400_BAD_REQUEST', 'Không xác định được địa chỉ IP của request.');
        }

        $identifier = mb_strtolower(trim($dto->identifier));
        if ($this->loginAttempts->countRecentFailures($identifier, $ipAddress) >= self::MAX_LOGIN_FAILURES) {
            $this->loginAttempts->record($identifier, $ipAddress, $userAgent, false, 'too_many_attempts');
            throw new ApiException('429_TOO_MANY_REQUESTS', self::RATE_LIMIT_MESSAGE);
        }

        $user = $this->users->findByIdentifier($identifier);
        $passwordHash = is_array($user) ? (string) $user['password_hash'] : $this->dummyPasswordHash();
        $passwordMatches = password_verify($dto->password, $passwordHash);
        if ($user === null || $user['deleted_at'] !== null || !$passwordMatches) {
            $this->loginAttempts->record($identifier, $ipAddress, $userAgent, false, 'invalid_credentials');
            if ($this->loginAttempts->countRecentFailures($identifier, $ipAddress) >= self::MAX_LOGIN_FAILURES) {
                throw new ApiException('429_TOO_MANY_REQUESTS', self::RATE_LIMIT_MESSAGE);
            }

            throw new ApiException('401_UNAUTHORIZED', 'Thông tin đăng nhập không chính xác.');
        }

        if ((int) $user['is_active'] !== 1) {
            throw new ApiException('403_FORBIDDEN', 'Tài khoản đã bị khóa hoặc vô hiệu hóa.');
        }

        $userId = (int) $user['id'];
        $roleCodes = $this->users->roleCodes($userId);
        if (!$this->hasAllowedRoleForClient($roleCodes, $clientType)) {
            throw new ApiException('403_FORBIDDEN', 'Tài khoản không được phép đăng nhập từ kênh này.');
        }

        $plainToken = bin2hex(random_bytes(32));
        $expiresAt = Database::transaction(function (PDO $pdo) use (
            $userId,
            $plainToken,
            $clientType,
            $ipAddress,
            $userAgent,
            $identifier,
        ): string {
            $this->users->updateLastLogin($userId);
            $this->loginAttempts->record($identifier, $ipAddress, $userAgent, true);

            return $this->tokens->create(
                $userId,
                $plainToken,
                $clientType,
                $ipAddress,
                $userAgent,
                (int) ($this->securityConfig['token_ttl_hours'] ?? 24),
            );
        });

        return [
            'access_token' => $plainToken,
            'token_type' => 'Bearer',
            'expires_at' => $expiresAt,
            'user' => $this->presentUser($user),
            'roles' => $roleCodes,
            'permissions' => $this->users->permissionCodes($userId),
            'branch_scopes' => $this->users->branchScopes($userId),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function me(int $userId): array
    {
        $user = $this->users->findById($userId);
        if ($user === null || $user['deleted_at'] !== null || (int) $user['is_active'] !== 1) {
            throw new ApiException('401_UNAUTHORIZED', 'Phiên đăng nhập không còn hợp lệ.');
        }

        $roleCodes = $this->users->roleCodes($userId);
        $result = [
            'user' => $this->presentUser($user),
            'roles' => $roleCodes,
            'permissions' => $this->users->permissionCodes($userId),
            'branch_scopes' => $this->users->branchScopes($userId),
        ];
        $customer = $this->users->customerProfile($userId);
        if ($customer !== null) {
            $result['customer'] = $customer;
        }

        return $result;
    }

    public function changePassword(
        int $userId,
        int $currentTokenId,
        ChangePasswordDto $dto,
        ?string $ipAddress,
        ?string $userAgent,
    ): void {
        $user = $this->users->findById($userId);
        if ($user === null || $user['deleted_at'] !== null || (int) $user['is_active'] !== 1) {
            throw new ApiException('401_UNAUTHORIZED', 'Phiên đăng nhập không còn hợp lệ.');
        }

        if (!password_verify($dto->current_password, (string) $user['password_hash'])) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Mật khẩu hiện tại không chính xác.',
                ['current_password' => ['Mật khẩu hiện tại không chính xác.']],
            );
        }

        $passwordHash = $this->hashPassword($dto->new_password);
        Database::transaction(function (PDO $pdo) use (
            $userId,
            $currentTokenId,
            $passwordHash,
            $ipAddress,
            $userAgent,
        ): void {
            $this->users->updatePassword($userId, $passwordHash);
            $this->tokens->revokeOtherUserTokens($userId, $currentTokenId);
            $this->auditLogs->recordPasswordChange($userId, $ipAddress, $userAgent);
        });
    }

    public function logout(int $tokenId): void
    {
        $this->tokens->revokeById($tokenId);
    }

    /**
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    private function presentUser(array $user): array
    {
        return [
            'public_id' => (string) $user['public_id'],
            'full_name' => (string) $user['full_name'],
            'email' => (string) $user['email'],
            'phone_masked' => (string) $user['phone_masked'],
            'employee_code' => $user['employee_code'] === null ? null : (string) $user['employee_code'],
            'user_type' => (string) $user['user_type'],
            'must_change_password' => (bool) $user['must_change_password'],
        ];
    }

    private function assertRegistrationIdentityAvailable(string $email, string $phoneHash): void
    {
        if ($this->users->emailExists($email)) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Email đã được đăng ký.',
                ['email' => ['Email đã được đăng ký.']],
            );
        }

        if ($this->users->phoneHashExists($phoneHash)) {
            throw new ApiException(
                '422_VALIDATION_ERROR',
                'Số điện thoại đã được đăng ký.',
                ['phone' => ['Số điện thoại đã được đăng ký.']],
            );
        }
    }

    private function generateCustomerCode(): string
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $customerCode = 'CUS' . UlidGenerator::generate();
            if (!$this->users->customerCodeExists($customerCode)) {
                return $customerCode;
            }
        }

        throw new ApiException('500_INTERNAL_ERROR', 'Không thể sinh mã khách hàng duy nhất.');
    }

    private function hashPassword(string $password): string
    {
        $algorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
        $passwordHash = password_hash($password, $algorithm);
        if ($passwordHash === false) {
            throw new ApiException('500_INTERNAL_ERROR', 'Không thể mã hóa mật khẩu.');
        }

        return $passwordHash;
    }

    private function dummyPasswordHash(): string
    {
        static $hash = null;
        if ($hash === null) {
            $dummyPassword = bin2hex(random_bytes(32));
            $hash = $this->hashPassword($dummyPassword);
        }

        return $hash;
    }

    private function assertClientType(string $clientType): void
    {
        if (!in_array($clientType, ['web_public', 'web_internal', 'mobile_driver'], true)) {
            throw new ApiException('400_BAD_REQUEST', 'X-Client-Type không hợp lệ.');
        }
    }

    /**
     * @param array<int, string> $roleCodes
     */
    private function hasAllowedRoleForClient(array $roleCodes, string $clientType): bool
    {
        $allowedRoles = match ($clientType) {
            'web_public' => ['customer_individual', 'customer_corporate'],
            'web_internal' => [
                'receptionist',
                'coordinator',
                'warehouse_staff',
                'branch_accountant',
                'hq_accountant',
                'branch_manager',
                'board_director',
                'system_admin',
                'system_dev',
            ],
            'mobile_driver' => ['pickup_delivery_driver', 'linehaul_driver'],
            default => [],
        };

        return array_intersect($roleCodes, $allowedRoles) !== [];
    }

    /**
     * @param array<string, mixed> $recovery
     * @return array<string, mixed>
     */
    private function recoverRegistration(
        RegisterCustomerDto $dto,
        string $phoneHash,
        string $ipAddress,
        ?string $userAgent,
        array $recovery,
    ): array {
        $userId = (int) $recovery['user_id'];
        $user = $this->users->findById($userId);
        if (
            $user === null
            || $user['deleted_at'] !== null
            || (int) $user['is_active'] !== 1
            || !hash_equals((string) $user['email'], $dto->email)
            || !hash_equals((string) $user['phone_hash'], $phoneHash)
            || !password_verify($dto->password, (string) $user['password_hash'])
        ) {
            throw new ApiException(
                '409_IDEMPOTENCY_DUPLICATE',
                'Không thể khôi phục yêu cầu đăng ký cũ; vui lòng đăng nhập hoặc liên hệ hỗ trợ.',
            );
        }

        $plainToken = bin2hex(random_bytes(32));
        $expiresAt = Database::transaction(function (PDO $pdo) use (
            $userId,
            $plainToken,
            $ipAddress,
            $userAgent,
        ): string {
            return $this->tokens->create(
                $userId,
                $plainToken,
                'web_public',
                $ipAddress,
                $userAgent,
                (int) ($this->securityConfig['token_ttl_hours'] ?? 24),
            );
        });
        $customer = $this->users->customerProfile($userId);
        $result = [
            'access_token' => $plainToken,
            'token_type' => 'Bearer',
            'expires_at' => $expiresAt,
            'user' => $this->presentUser($user),
            'customer' => $customer,
            '_idempotency_record_id' => (int) $recovery['record_id'],
        ];

        return $result;
    }
}
