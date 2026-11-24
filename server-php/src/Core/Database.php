<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use RuntimeException;
use Throwable;

final class Database
{
    private static ?PDO $connection = null;
    private static int $transactionDepth = 0;

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
        $ownsTransaction = !$pdo->inTransaction();
        $savepoint = 'app_nested_' . self::$transactionDepth;

        if ($ownsTransaction) {
            $pdo->beginTransaction();
        } else {
            $pdo->exec('SAVEPOINT ' . $savepoint);
        }

        self::$transactionDepth++;

        try {
            $result = $callback($pdo);
            if ($ownsTransaction) {
                $pdo->commit();
            } else {
                $pdo->exec('RELEASE SAVEPOINT ' . $savepoint);
            }

            return $result;
        } catch (Throwable $exception) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            } elseif (!$ownsTransaction && $pdo->inTransaction()) {
                $pdo->exec('ROLLBACK TO SAVEPOINT ' . $savepoint);
                $pdo->exec('RELEASE SAVEPOINT ' . $savepoint);
            }

            throw $exception;
        } finally {
            self::$transactionDepth--;
        }
    }
}
