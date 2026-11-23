<?php

declare(strict_types=1);

use App\Core\Database;
use Dotenv\Dotenv;

$projectRoot = dirname(__DIR__);
require $projectRoot . '/vendor/autoload.php';

Dotenv::createImmutable($projectRoot)->safeLoad();

try {
    $pdo = Database::getConnection();
    $versionStatement = $pdo->prepare(
        'SELECT VERSION() AS mysql_version, DATABASE() AS current_db, @@session.time_zone AS session_tz'
    );
    $versionStatement->execute();
    $databaseDetails = $versionStatement->fetch(PDO::FETCH_ASSOC);
    $tablesStatement = $pdo->prepare('SHOW TABLES');
    $tablesStatement->execute();
    $tables = $tablesStatement->fetchAll(PDO::FETCH_COLUMN);

    fwrite(STDOUT, "MySQL connection successful.\n");
    fwrite(STDOUT, 'Version: ' . (string) $databaseDetails['mysql_version'] . "\n");
    fwrite(STDOUT, 'Database: ' . (string) $databaseDetails['current_db'] . "\n");
    fwrite(STDOUT, 'Session time zone: ' . (string) $databaseDetails['session_tz'] . "\n");
    fwrite(STDOUT, 'Existing table count: ' . count($tables) . "\n");
    fwrite(STDOUT, 'Tables: ' . ($tables === [] ? '(none)' : implode(', ', $tables)) . "\n");
} catch (PDOException $exception) {
    fwrite(STDERR, 'MySQL connection failed: ' . $exception->getMessage() . "\n");
    fwrite(STDERR, "Check DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME and DB_PASSWORD in server-php/.env.\n");
    exit(1);
} catch (Throwable $exception) {
    fwrite(STDERR, 'Database test failed: ' . $exception->getMessage() . "\n");
    exit(1);
}
