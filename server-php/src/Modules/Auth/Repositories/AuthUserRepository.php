<?php

declare(strict_types=1);

namespace App\Modules\Auth\Repositories;

use PDO;
use RuntimeException;

final class AuthUserRepository
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findByIdentifier(string $identifier): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, employee_code, full_name, email, phone_masked, password_hash,
                    user_type, must_change_password, is_active, phone_hash, deleted_at
             FROM users
             WHERE (email = :email_identifier OR employee_code = :employee_identifier)
             LIMIT 1'
        );
        $statement->execute([
            ':email_identifier' => $identifier,
            ':employee_identifier' => $identifier,
        ]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);

        return $user === false ? null : $user;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findById(int $userId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT id, public_id, employee_code, full_name, email, phone_masked, password_hash,
                    user_type, must_change_password, is_active, phone_hash, deleted_at
             FROM users
             WHERE id = :user_id
             LIMIT 1'
        );
        $statement->execute([':user_id' => $userId]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);

        return $user === false ? null : $user;
    }

    public function emailExists(string $email): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM users WHERE email = :email LIMIT 1');
        $statement->execute([':email' => $email]);

        return $statement->fetchColumn() !== false;
    }

    public function phoneHashExists(string $phoneHash): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1
             FROM users
             WHERE phone_hash = :user_phone_hash
             UNION ALL
             SELECT 1
             FROM customers
             WHERE phone_hash = :customer_phone_hash
             LIMIT 1'
        );
        $statement->execute([
            ':user_phone_hash' => $phoneHash,
            ':customer_phone_hash' => $phoneHash,
        ]);

        return $statement->fetchColumn() !== false;
    }

    /**
     * @param array<string, mixed> $user
     */
    public function createUser(array $user): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO users
                (public_id, full_name, email, phone_encrypted, phone_hash, phone_masked,
                 password_hash, user_type, must_change_password, is_active)
             VALUES
                (:public_id, :full_name, :email, :phone_encrypted, :phone_hash, :phone_masked,
                 :password_hash, :user_type, :must_change_password, :is_active)'
        );
        $statement->execute([
            ':public_id' => $user['public_id'],
            ':full_name' => $user['full_name'],
            ':email' => $user['email'],
            ':phone_encrypted' => $user['phone_encrypted'],
            ':phone_hash' => $user['phone_hash'],
            ':phone_masked' => $user['phone_masked'],
            ':password_hash' => $user['password_hash'],
            ':user_type' => $user['user_type'],
            ':must_change_password' => $user['must_change_password'],
            ':is_active' => $user['is_active'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function roleIdForCode(string $roleCode): int
    {
        $statement = $this->pdo->prepare('SELECT id FROM roles WHERE code = :role_code LIMIT 1');
        $statement->execute([':role_code' => $roleCode]);
        $roleId = $statement->fetchColumn();

        if ($roleId === false) {
            throw new RuntimeException('Required role is not seeded: ' . $roleCode);
        }

        return (int) $roleId;
    }

    public function assignRole(int $userId, int $roleId): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO user_has_roles (user_id, role_id) VALUES (:user_id, :role_id)'
        );
        $statement->execute([
            ':user_id' => $userId,
            ':role_id' => $roleId,
        ]);
    }

    /**
     * @param array<string, mixed> $customer
     */
    public function createCustomer(array $customer): int
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO customers
                (public_id, user_id, customer_code, customer_type, company_name, tax_code,
                 full_name, phone_encrypted, phone_hash, phone_masked, email)
             VALUES
                (:public_id, :user_id, :customer_code, :customer_type, :company_name, :tax_code,
                 :full_name, :phone_encrypted, :phone_hash, :phone_masked, :email)'
        );
        $statement->execute([
            ':public_id' => $customer['public_id'],
            ':user_id' => $customer['user_id'],
            ':customer_code' => $customer['customer_code'],
            ':customer_type' => $customer['customer_type'],
            ':company_name' => $customer['company_name'],
            ':tax_code' => $customer['tax_code'],
            ':full_name' => $customer['full_name'],
            ':phone_encrypted' => $customer['phone_encrypted'],
            ':phone_hash' => $customer['phone_hash'],
            ':phone_masked' => $customer['phone_masked'],
            ':email' => $customer['email'],
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    public function customerCodeExists(string $customerCode): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT 1 FROM customers WHERE customer_code = :customer_code LIMIT 1'
        );
        $statement->execute([':customer_code' => $customerCode]);

        return $statement->fetchColumn() !== false;
    }

    /**
     * @return array<int, string>
     */
    public function roleCodes(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT r.code
             FROM user_has_roles uhr
             INNER JOIN roles r ON r.id = uhr.role_id
             WHERE uhr.user_id = :user_id
             ORDER BY r.code'
        );
        $statement->execute([':user_id' => $userId]);

        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /**
     * @return array<int, string>
     */
    public function permissionCodes(int $userId): array
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

        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /**
     * @return array<int, array<string, bool|string|null>>
     */
    public function branchScopes(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT ubs.scope_type, ubs.is_primary,
                    b.public_id AS branch_public_id, b.code AS branch_code, b.name AS branch_name,
                    w.public_id AS warehouse_public_id, w.code AS warehouse_code, w.name AS warehouse_name
             FROM user_branch_scopes ubs
             LEFT JOIN branches b ON b.id = ubs.branch_id
             LEFT JOIN warehouses w ON w.id = ubs.warehouse_id
             WHERE ubs.user_id = :user_id
             ORDER BY ubs.is_primary DESC, ubs.scope_type, ubs.branch_id, ubs.warehouse_id'
        );
        $statement->execute([':user_id' => $userId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static function (array $row): array {
            return [
                'scope_type' => (string) $row['scope_type'],
                'branch_public_id' => $row['branch_public_id'] === null ? null : (string) $row['branch_public_id'],
                'branch_code' => $row['branch_code'] === null ? null : (string) $row['branch_code'],
                'branch_name' => $row['branch_name'] === null ? null : (string) $row['branch_name'],
                'warehouse_public_id' => $row['warehouse_public_id'] === null
                    ? null
                    : (string) $row['warehouse_public_id'],
                'warehouse_code' => $row['warehouse_code'] === null ? null : (string) $row['warehouse_code'],
                'warehouse_name' => $row['warehouse_name'] === null ? null : (string) $row['warehouse_name'],
                'is_primary' => (bool) $row['is_primary'],
            ];
        }, $rows);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function customerProfile(int $userId): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT public_id, customer_code, customer_type, company_name, tax_code,
                    full_name, phone_masked, email
             FROM customers
             WHERE user_id = :user_id
               AND deleted_at IS NULL
             LIMIT 1'
        );
        $statement->execute([':user_id' => $userId]);
        $customer = $statement->fetch(PDO::FETCH_ASSOC);

        if ($customer === false) {
            return null;
        }

        return [
            'public_id' => (string) $customer['public_id'],
            'customer_code' => (string) $customer['customer_code'],
            'customer_type' => (string) $customer['customer_type'],
            'company_name' => $customer['company_name'] === null ? null : (string) $customer['company_name'],
            'tax_code' => $customer['tax_code'] === null ? null : (string) $customer['tax_code'],
            'full_name' => (string) $customer['full_name'],
            'phone_masked' => (string) $customer['phone_masked'],
            'email' => $customer['email'] === null ? null : (string) $customer['email'],
        ];
    }

    public function updateLastLogin(int $userId): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE users SET last_login_at = NOW() WHERE id = :user_id AND deleted_at IS NULL'
        );
        $statement->execute([':user_id' => $userId]);
    }

    public function updatePassword(int $userId, string $passwordHash): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE users
             SET password_hash = :password_hash,
                 must_change_password = 0
             WHERE id = :user_id
               AND deleted_at IS NULL'
        );
        $statement->execute([
            ':password_hash' => $passwordHash,
            ':user_id' => $userId,
        ]);

        if ($statement->rowCount() !== 1) {
            throw new RuntimeException('User password could not be updated.');
        }
    }

    public function createRegistrationIdempotency(
        int $userId,
        string $idempotencyKey,
        string $endpoint,
        string $requestHash,
    ): int {
        $statement = $this->pdo->prepare(
            "INSERT INTO idempotency_keys
                (user_id, idempotency_key, endpoint, request_hash, status, expires_at)
             VALUES
                (:user_id, :idempotency_key, :endpoint, :request_hash, 'processing',
                 DATE_ADD(NOW(), INTERVAL 24 HOUR))"
        );
        $statement->execute([
            ':user_id' => $userId,
            ':idempotency_key' => $idempotencyKey,
            ':endpoint' => $endpoint,
            ':request_hash' => $requestHash,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

}
