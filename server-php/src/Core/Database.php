<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use RuntimeException;
use Throwable;

final class Database
{
    private static ?PDO $connection = null;

    /**
     * @param array<string, mixed>|null $config
     */
    public static function getConnection(?array $config = null): PDO
    {
        if (self::$connection !== null) {
            return self::$connection;
        }

        $databaseConfig = $config ?? require dirname(__DIR__, 2) . '/config/database.php';
        foreach (['host', 'database', 'username', 'password'] as $requiredKey) {
            if (!array_key_exists($requiredKey, $databaseConfig)) {
                throw new RuntimeException('Missing database configuration: ' . $requiredKey);
            }
        }

        if (trim((string) $databaseConfig['database']) === '') {
            throw new RuntimeException('DB_DATABASE is not configured.');
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
            (string) $databaseConfig['host'],
            (int) ($databaseConfig['port'] ?? 3306),
            (string) $databaseConfig['database'],
        );

        self::$connection = new PDO($dsn, (string) $databaseConfig['username'], (string) $databaseConfig['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        self::$connection->exec("SET time_zone = '+07:00'");

        return self::$connection;
    }

    public static function transaction(callable $callback): mixed
    {
        $pdo = self::getConnection();
        $pdo->beginTransaction();

        try {
            $result = $callback($pdo);
            $pdo->commit();

            return $result;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }
}
