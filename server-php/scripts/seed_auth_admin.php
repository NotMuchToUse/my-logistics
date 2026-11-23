<?php

declare(strict_types=1);

use App\Core\Crypto;
use App\Core\Database;
use App\Core\UlidGenerator;
use Dotenv\Dotenv;

$projectRoot = dirname(__DIR__);
require $projectRoot . '/vendor/autoload.php';
Dotenv::createImmutable($projectRoot)->safeLoad();

try {
    $pdo = Database::getConnection();
    $roleSeed = file_get_contents($projectRoot . '/database/seeds/001_seed_auth_roles.sql');
    if ($roleSeed === false) {
        throw new RuntimeException('Không đọc được dữ liệu seed roles.');
    }

    $pdo->exec($roleSeed);
    $email = 'admin@vietstar.vn';
    $existingUser = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $existingUser->execute([':email' => $email]);
    if ($existingUser->fetchColumn() !== false) {
        throw new RuntimeException('Tài khoản admin@vietstar.vn đã tồn tại; không thể cấp lại mật khẩu khởi tạo.');
    }

    $roleStatement = $pdo->prepare('SELECT id FROM roles WHERE code = :role_code LIMIT 1');
    $roleStatement->execute([':role_code' => 'system_admin']);
    $roleId = $roleStatement->fetchColumn();
    if ($roleId === false) {
        throw new RuntimeException('Không tìm thấy role system_admin sau khi seed.');
    }

    do {
        $initialPassword = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    } while (
        preg_match('/[A-Z]/', $initialPassword) !== 1
        || preg_match('/[a-z]/', $initialPassword) !== 1
        || preg_match('/[0-9]/', $initialPassword) !== 1
        || preg_match('/[-_]/', $initialPassword) !== 1
    );

    $hashAlgorithm = defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    $passwordHash = password_hash($initialPassword, $hashAlgorithm);
    if ($passwordHash === false) {
        throw new RuntimeException('Không thể tạo hash cho mật khẩu khởi tạo.');
    }

    $pdo->beginTransaction();
    $phone = null;
    $phoneHash = null;
    $phoneEncrypted = null;
    $phoneMasked = null;
    $phoneExists = $pdo->prepare(
        'SELECT 1
         FROM users
         WHERE phone_hash = :user_phone_hash
         UNION ALL
         SELECT 1
         FROM customers
         WHERE phone_hash = :customer_phone_hash
         LIMIT 1'
    );

    for ($attempt = 0; $attempt < 10; $attempt++) {
        $phone = '09' . (string) random_int(10000000, 99999999);
        $phoneHash = Crypto::hashPhone($phone);
        $phoneExists->execute([
            ':user_phone_hash' => $phoneHash,
            ':customer_phone_hash' => $phoneHash,
        ]);
        if ($phoneExists->fetchColumn() === false) {
            $phoneEncrypted = Crypto::encrypt($phone);
            $phoneMasked = Crypto::maskPhone($phone);
            break;
        }
    }

    if ($phoneHash === null || $phoneEncrypted === null || $phoneMasked === null) {
        throw new RuntimeException('Không thể tạo số điện thoại nội bộ chưa được sử dụng.');
    }

    $employeeCode = 'ADM' . strtoupper(bin2hex(random_bytes(4)));
    $insertUser = $pdo->prepare(
        'INSERT INTO users
            (public_id, employee_code, full_name, email, phone_encrypted, phone_hash, phone_masked,
             password_hash, user_type, must_change_password, is_active)
         VALUES
            (:public_id, :employee_code, :full_name, :email, :phone_encrypted, :phone_hash, :phone_masked,
             :password_hash, :user_type, 1, 1)'
    );
    $insertUser->execute([
        ':public_id' => UlidGenerator::generate(),
        ':employee_code' => $employeeCode,
        ':full_name' => 'Quản trị hệ thống',
        ':email' => $email,
        ':phone_encrypted' => $phoneEncrypted,
        ':phone_hash' => $phoneHash,
        ':phone_masked' => $phoneMasked,
        ':password_hash' => $passwordHash,
        ':user_type' => 'staff',
    ]);
    $userId = (int) $pdo->lastInsertId();

    $assignRole = $pdo->prepare(
        'INSERT INTO user_has_roles (user_id, role_id) VALUES (:user_id, :role_id)'
    );
    $assignRole->execute([
        ':user_id' => $userId,
        ':role_id' => (int) $roleId,
    ]);
    $pdo->commit();

    echo "Admin account created: {$email}" . PHP_EOL;
    echo "Employee code: {$employeeCode}" . PHP_EOL;
    echo "Initial password (shown once): {$initialPassword}" . PHP_EOL;
    echo "Change the password immediately after the first login." . PHP_EOL;
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    fwrite(STDERR, 'Admin seed failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
