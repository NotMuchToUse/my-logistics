<?php

declare(strict_types=1);

use App\Core\ApiException;
use App\Core\Crypto;
use App\Core\Database;
use App\Core\Request;
use App\Core\Router;
use App\Core\UlidGenerator;
use Dotenv\Dotenv;

$projectRoot = dirname(__DIR__);
require $projectRoot . '/vendor/autoload.php';
Dotenv::createImmutable($projectRoot)->safeLoad();

/**
 * @param array<string, mixed> $body
 * @param array<string, mixed> $query
 * @param array<string, string> $headers
 * @return array{status: int, payload: array<string, mixed>}
 */
function dispatchShipmentRequest(
    Router $router,
    string $method,
    string $path,
    array $body = [],
    array $query = [],
    array $headers = [],
): array {
    $rawBody = $body === []
        ? ''
        : json_encode($body, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $request = new Request(
        $method,
        $path,
        $query,
        $rawBody,
        [],
        [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'X-Client-Type' => 'web_internal',
            'X-Branch-Id' => '3',
            ...$headers,
        ],
        '127.0.0.1',
        'ShipmentModuleTest/1.0',
    );
    $response = $router->dispatch($request);
    $payload = json_decode($response->body(), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($payload)) {
        throw new RuntimeException('API returned a non-object JSON payload.');
    }

    return ['status' => $response->statusCode(), 'payload' => $payload];
}

function assertShipmentTest(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function shipmentTestUuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);

    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12),
    );
}

function cleanupShipmentTestUser(PDO $pdo, int $userId): void
{
    $statement = $pdo->prepare('SELECT id FROM shipments WHERE created_by = :user_id ORDER BY id DESC');
    $statement->execute([':user_id' => $userId]);
    $shipmentIds = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));

    foreach ($shipmentIds as $shipmentId) {
        $deletePrintLogs = $pdo->prepare(
            "DELETE FROM print_logs WHERE reference_table = 'shipments' AND reference_id = :shipment_id"
        );
        $deletePrintLogs->execute([':shipment_id' => $shipmentId]);
        $deleteAuditLogs = $pdo->prepare(
            "DELETE FROM audit_logs WHERE table_name = 'shipments' AND record_id = :shipment_id"
        );
        $deleteAuditLogs->execute([':shipment_id' => $shipmentId]);
        foreach (['shipment_status_history', 'cod_transactions', 'shipment_vas', 'shipment_surcharges', 'shipment_parcels'] as $table) {
            $deleteChildren = $pdo->prepare('DELETE FROM `' . $table . '` WHERE shipment_id = :shipment_id');
            $deleteChildren->execute([':shipment_id' => $shipmentId]);
        }
        $deleteShipment = $pdo->prepare('DELETE FROM shipments WHERE id = :shipment_id');
        $deleteShipment->execute([':shipment_id' => $shipmentId]);
    }

    foreach (['idempotency_keys', 'personal_access_tokens', 'user_branch_scopes', 'user_has_roles'] as $table) {
        $deleteUserRows = $pdo->prepare('DELETE FROM `' . $table . '` WHERE user_id = :user_id');
        $deleteUserRows->execute([':user_id' => $userId]);
    }
    $deleteAuditLogs = $pdo->prepare('DELETE FROM audit_logs WHERE user_id = :user_id');
    $deleteAuditLogs->execute([':user_id' => $userId]);
    $deleteUser = $pdo->prepare('DELETE FROM users WHERE id = :user_id');
    $deleteUser->execute([':user_id' => $userId]);
}

$pdo = null;
$testUserId = null;
$failure = null;
$passed = false;

try {
    $pdo = Database::getConnection();
    $permissionCount = (int) $pdo->query(
        "SELECT COUNT(*) FROM permissions WHERE module = 'shipments'"
    )->fetchColumn();
    if ($permissionCount !== 6) {
        throw new RuntimeException('Run database/seeds/003_seed_shipment_permissions.sql before this test.');
    }

    $rangeQuery = $pdo->prepare(
        "SELECT current_number
         FROM tracking_number_ranges
         WHERE branch_id = :branch_id AND status = 'active'
         ORDER BY id LIMIT 1"
    );
    $rangeQuery->execute([':branch_id' => 3]);
    $initialRangeNumber = $rangeQuery->fetchColumn();
    if ($initialRangeNumber === false) {
        throw new RuntimeException('No active tracking number range exists for branch 3.');
    }
    $initialRangeNumber = (int) $initialRangeNumber;

    $roleQuery = $pdo->query("SELECT id FROM roles WHERE code = 'system_admin' LIMIT 1");
    $roleId = $roleQuery->fetchColumn();
    if ($roleId === false) {
        throw new RuntimeException('Run database/seeds/001_seed_auth_roles.sql before this test.');
    }

    $email = 'shipment-test-' . bin2hex(random_bytes(6)) . '@example.test';
    $phone = '09' . (string) random_int(10000000, 99999999);
    $plainToken = bin2hex(random_bytes(32));
    $insertUser = $pdo->prepare(
        'INSERT INTO users
            (public_id, full_name, email, phone_encrypted, phone_hash, phone_masked,
             password_hash, user_type, must_change_password, is_active, created_at, updated_at)
         VALUES
            (:public_id, :full_name, :email, :phone_encrypted, :phone_hash, :phone_masked,
             :password_hash, :user_type, 0, 1, NOW(), NOW())'
    );
    $insertUser->execute([
        ':public_id' => UlidGenerator::generate(),
        ':full_name' => 'Shipment module integration test',
        ':email' => $email,
        ':phone_encrypted' => Crypto::encrypt($phone),
        ':phone_hash' => Crypto::hashPhone($phone),
        ':phone_masked' => Crypto::maskPhone($phone),
        ':password_hash' => password_hash('ShipmentTestPasswordA1!', PASSWORD_BCRYPT),
        ':user_type' => 'staff',
    ]);
    $testUserId = (int) $pdo->lastInsertId();

    $assignRole = $pdo->prepare(
        'INSERT INTO user_has_roles (user_id, role_id, assigned_by, assigned_at)
         VALUES (:user_id, :role_id, NULL, NOW())'
    );
    $assignRole->execute([':user_id' => $testUserId, ':role_id' => (int) $roleId]);
    $assignScope = $pdo->prepare(
        "INSERT INTO user_branch_scopes
            (user_id, scope_type, branch_id, warehouse_id, is_primary, created_at, updated_at)
         VALUES (:user_id, 'hq_all', NULL, NULL, 1, NOW(), NOW())"
    );
    $assignScope->execute([':user_id' => $testUserId]);
    $insertToken = $pdo->prepare(
        'INSERT INTO personal_access_tokens
            (user_id, token_name, token_hash, device_type, ip_address, user_agent, expires_at, created_at)
         VALUES
            (:user_id, :token_name, :token_hash, :device_type, :ip_address, :user_agent,
             DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())'
    );
    $insertToken->execute([
        ':user_id' => $testUserId,
        ':token_name' => 'Shipment test',
        ':token_hash' => hash('sha256', $plainToken),
        ':device_type' => 'web_internal',
        ':ip_address' => '127.0.0.1',
        ':user_agent' => 'ShipmentModuleTest/1.0',
    ]);

    $router = new Router();
    $registerRoutes = require $projectRoot . '/src/Modules/Shipment/routes.php';
    $registerRoutes($router);
    $authorization = ['Authorization' => 'Bearer ' . $plainToken];
    $headers = [...$authorization, 'Idempotency-Key' => shipmentTestUuid()];

    $vasId = (int) $pdo->query(
        'SELECT id FROM value_added_services WHERE is_active = 1 ORDER BY id LIMIT 1'
    )->fetchColumn();
    $surchargeId = (int) $pdo->query(
        'SELECT id FROM surcharges WHERE is_active = 1 ORDER BY id LIMIT 1'
    )->fetchColumn();
    $createBody = [
        'sender_name' => 'Shipment Test Sender',
        'sender_phone' => '0901234987',
        'sender_address' => '10 Test Street',
        'sender_province_id' => 1,
        'sender_district_id' => 101,
        'sender_ward_id' => 1001,
        'recipient_name' => 'Shipment Test Recipient',
        'recipient_phone' => '0912345678',
        'recipient_address' => '20 Test Street',
        'recipient_province_id' => 2,
        'recipient_district_id' => 201,
        'recipient_ward_id' => 2001,
        'destination_branch_id' => 4,
        'service_type_id' => 2,
        'cargo_category_id' => 2,
        'payment_method' => 'nntn',
        'cod_amount' => '25000.00',
        'declared_value' => '100000.00',
        'creation_mode' => 'driver_pickup',
        'parcels' => [
            [
                'actual_weight_gram' => 500,
                'length_cm' => '20',
                'width_cm' => '30',
                'height_cm' => '40',
                'description' => 'Test parcel one',
            ],
            [
                'actual_weight_gram' => 800,
                'length_cm' => '10',
                'width_cm' => '20',
                'height_cm' => '30',
                'description' => 'Test parcel two',
            ],
        ],
        'vas_ids' => $vasId > 0 ? [$vasId] : [],
        'surcharge_ids' => $surchargeId > 0 ? [$surchargeId] : [],
    ];

    $created = dispatchShipmentRequest($router, 'POST', '/api/v1/shipments', $createBody, [], $headers);
    assertShipmentTest($created['status'] === 201, 'Shipment create did not return HTTP 201.');
    $createdData = $created['payload']['data'] ?? null;
    assertShipmentTest(
        is_array($createdData) && is_string($createdData['public_id'] ?? null),
        'Shipment create response omitted its public ID.',
    );
    $publicId = $createdData['public_id'];
    $shipmentIdQuery = $pdo->prepare('SELECT id FROM shipments WHERE public_id = :public_id LIMIT 1');
    $shipmentIdQuery->execute([':public_id' => $publicId]);
    $shipmentId = (int) $shipmentIdQuery->fetchColumn();

    $replayed = dispatchShipmentRequest($router, 'POST', '/api/v1/shipments', $createBody, [], $headers);
    assertShipmentTest(
        $replayed['payload']['data']['tracking_code'] === $createdData['tracking_code'],
        'Create replay did not return the original response.',
    );
    $rangeQuery->execute([':branch_id' => 3]);
    assertShipmentTest(
        (int) $rangeQuery->fetchColumn() === $initialRangeNumber + 1,
        'Idempotent replay allocated an extra tracking number.',
    );

    $parcelQuery = $pdo->prepare(
        'SELECT length_cm, width_cm, height_cm, actual_weight_gram,
                volumetric_weight_gram, chargeable_weight_gram
         FROM shipment_parcels WHERE shipment_id = :shipment_id ORDER BY parcel_index'
    );
    $parcelQuery->execute([':shipment_id' => $shipmentId]);
    $parcels = $parcelQuery->fetchAll(PDO::FETCH_ASSOC);
    assertShipmentTest(count($parcels) === 2, 'The shipment does not contain both parcels.');
    $weightRuleQuery = $pdo->prepare(
        'SELECT divisor, min_chargeable_gram
         FROM weight_conversion_rules WHERE service_type_id = 2 AND is_active = 1 LIMIT 1'
    );
    $weightRuleQuery->execute();
    $weightRule = $weightRuleQuery->fetch(PDO::FETCH_ASSOC);
    $divisor = (int) $weightRule['divisor'];
    $minChargeableWeight = (int) $weightRule['min_chargeable_gram'];
    $totalActualWeight = 0;
    $totalVolumetricWeight = 0;
    $totalChargeableWeight = 0;
    foreach ($parcels as $parcel) {
        $expected = (int) ceil(
            ((float) $parcel['length_cm'] * (float) $parcel['width_cm'] * (float) $parcel['height_cm'] * 1000)
            / $divisor,
        );
        assertShipmentTest((int) $parcel['volumetric_weight_gram'] === $expected, 'Volumetric weight is incorrect.');
        $expectedChargeable = max((int) $parcel['actual_weight_gram'], $expected, $minChargeableWeight);
        assertShipmentTest(
            (int) $parcel['chargeable_weight_gram'] === $expectedChargeable,
            'Parcel chargeable weight does not match the actual/volumetric minimum.',
        );
        $totalActualWeight += (int) $parcel['actual_weight_gram'];
        $totalVolumetricWeight += $expected;
        $totalChargeableWeight += $expectedChargeable;
    }
    $weightTotalsQuery = $pdo->prepare(
        'SELECT total_actual_weight_gram, total_volumetric_weight_gram, chargeable_weight_gram
         FROM shipments WHERE id = :shipment_id'
    );
    $weightTotalsQuery->execute([':shipment_id' => $shipmentId]);
    $weightTotals = $weightTotalsQuery->fetch(PDO::FETCH_ASSOC);
    assertShipmentTest(
        (int) $weightTotals['total_actual_weight_gram'] === $totalActualWeight
            && (int) $weightTotals['total_volumetric_weight_gram'] === $totalVolumetricWeight
            && (int) $weightTotals['chargeable_weight_gram'] === $totalChargeableWeight,
        'Shipment aggregate weights do not match its parcels.',
    );

    $snapshotCountsQuery = $pdo->prepare(
        'SELECT
            (SELECT COUNT(*) FROM shipment_vas WHERE shipment_id = :vas_shipment_id) AS vas_count,
            (SELECT COUNT(*) FROM shipment_surcharges WHERE shipment_id = :surcharge_shipment_id) AS surcharge_count'
    );
    $snapshotCountsQuery->execute([
        ':vas_shipment_id' => $shipmentId,
        ':surcharge_shipment_id' => $shipmentId,
    ]);
    $snapshotCounts = $snapshotCountsQuery->fetch(PDO::FETCH_ASSOC);
    assertShipmentTest(
        (int) $snapshotCounts['vas_count'] === ($vasId > 0 ? 1 : 0)
            && (int) $snapshotCounts['surcharge_count'] === ($surchargeId > 0 ? 1 : 0),
        'Vas or surcharge fee snapshots are missing.',
    );

    $priceQuery = $pdo->prepare(
        'SELECT base_freight_amount, surcharge_amount, vas_amount, vat_amount, total_freight_amount
         FROM shipments WHERE id = :shipment_id'
    );
    $priceQuery->execute([':shipment_id' => $shipmentId]);
    $price = $priceQuery->fetch(PDO::FETCH_ASSOC);
    $expectedTotal = bcadd(
        bcadd(
            bcadd((string) $price['base_freight_amount'], (string) $price['surcharge_amount'], 2),
            (string) $price['vas_amount'],
            2,
        ),
        (string) $price['vat_amount'],
        2,
    );
    assertShipmentTest(
        bccomp($expectedTotal, (string) $price['total_freight_amount'], 2) === 0,
        'Stored freight total differs from its snapshots.',
    );
    $codQuery = $pdo->prepare('SELECT COUNT(*) FROM cod_transactions WHERE shipment_id = :shipment_id');
    $codQuery->execute([':shipment_id' => $shipmentId]);
    assertShipmentTest((int) $codQuery->fetchColumn() === 2, 'COD ledger rows are missing.');
    $historyQuery = $pdo->prepare('SELECT COUNT(*) FROM shipment_status_history WHERE shipment_id = :shipment_id');
    $historyQuery->execute([':shipment_id' => $shipmentId]);
    assertShipmentTest((int) $historyQuery->fetchColumn() === 1, 'Initial status history is missing.');

    $list = dispatchShipmentRequest(
        $router,
        'GET',
        '/api/v1/shipments',
        [],
        ['status' => 'pending_pickup', 'phone' => '0901234987', 'service_type_id' => '2'],
        $authorization,
    );
    assertShipmentTest(
        $list['status'] === 200 && ($list['payload']['meta']['pagination']['total'] ?? 0) >= 1,
        'Shipment list filtering failed.',
    );
    $detail = dispatchShipmentRequest(
        $router,
        'GET',
        '/api/v1/shipments/' . $publicId,
        [],
        [],
        $authorization,
    );
    $detailData = $detail['payload']['data'] ?? [];
    assertShipmentTest(
        $detail['status'] === 200
            && ($detailData['sender_phone'] ?? null) === '0901234987'
            && count($detailData['shipment_parcels'] ?? []) === 2,
        'Shipment detail response is incomplete.',
    );
    foreach (['sender_phone_hash', 'sender_phone_encrypted', 'recipient_phone_hash', 'recipient_phone_encrypted'] as $sensitiveKey) {
        assertShipmentTest(!array_key_exists($sensitiveKey, $detailData), 'Shipment detail exposed a sensitive field.');
    }

    $priority = dispatchShipmentRequest(
        $router,
        'PATCH',
        '/api/v1/shipments/' . $publicId . '/priority',
        ['version' => 1, 'is_priority' => true],
        [],
        $authorization,
    );
    assertShipmentTest(
        $priority['status'] === 200 && ($priority['payload']['data']['version'] ?? null) === 2,
        'Priority update did not increment the version.',
    );
    try {
        dispatchShipmentRequest(
            $router,
            'PATCH',
            '/api/v1/shipments/' . $publicId . '/priority',
            ['version' => 1, 'is_priority' => false],
            [],
            $authorization,
        );
        throw new RuntimeException('A stale version was accepted.');
    } catch (ApiException $exception) {
        assertShipmentTest($exception->errorCode === '409_VERSION_CONFLICT', 'Stale version returned the wrong error.');
    }

    $print = dispatchShipmentRequest(
        $router,
        'POST',
        '/api/v1/shipments/' . $publicId . '/print-logs',
        ['document_type' => 'barcode_sticker', 'print_count' => 2],
        [],
        $authorization,
    );
    assertShipmentTest($print['status'] === 201, 'Print log request failed.');
    $cancel = dispatchShipmentRequest(
        $router,
        'POST',
        '/api/v1/shipments/' . $publicId . '/cancel',
        ['version' => 2, 'cancel_reason' => 'Shipment module integration test'],
        [],
        $authorization,
    );
    assertShipmentTest(
        $cancel['status'] === 200
            && ($cancel['payload']['data']['status'] ?? null) === 'cancelled'
            && ($cancel['payload']['data']['version'] ?? null) === 3,
        'Shipment cancellation failed.',
    );

    $parentCreated = dispatchShipmentRequest(
        $router,
        'POST',
        '/api/v1/shipments',
        [...$createBody, 'sender_phone' => '0909876543'],
        [],
        [...$authorization, 'Idempotency-Key' => shipmentTestUuid()],
    );
    assertShipmentTest($parentCreated['status'] === 201, 'Forward parent shipment creation failed.');
    $parentPublicId = $parentCreated['payload']['data']['public_id'];
    $shipmentIdQuery->execute([':public_id' => $parentPublicId]);
    $parentId = (int) $shipmentIdQuery->fetchColumn();
    $setParentStatus = $pdo->prepare(
        "UPDATE shipments SET status = 'delivery_failed' WHERE id = :shipment_id"
    );
    $setParentStatus->execute([':shipment_id' => $parentId]);

    $forward = dispatchShipmentRequest(
        $router,
        'POST',
        '/api/v1/shipments/' . $parentPublicId . '/forward',
        [
            'recipient_name' => 'Forward Test Recipient',
            'recipient_phone' => '0923456789',
            'recipient_address' => '30 Forward Street',
            'recipient_province_id' => 3,
            'recipient_district_id' => 302,
            'recipient_ward_id' => 3002,
            'destination_branch_id' => 5,
        ],
        [],
        [...$authorization, 'Idempotency-Key' => shipmentTestUuid()],
    );
    assertShipmentTest($forward['status'] === 201, 'Forward request failed.');
    $childPublicId = $forward['payload']['data']['public_id'];
    $shipmentIdQuery->execute([':public_id' => $childPublicId]);
    $childId = (int) $shipmentIdQuery->fetchColumn();
    $childQuery = $pdo->prepare(
        'SELECT shipment_type, parent_shipment_id FROM shipments WHERE id = :shipment_id'
    );
    $childQuery->execute([':shipment_id' => $childId]);
    $child = $childQuery->fetch(PDO::FETCH_ASSOC);
    assertShipmentTest(
        $child['shipment_type'] === 'forward_shipment' && (int) $child['parent_shipment_id'] === $parentId,
        'Forward shipment type or parent reference is incorrect.',
    );
    $parentCodQuery = $pdo->prepare(
        "SELECT COUNT(*) FROM cod_transactions WHERE shipment_id = :shipment_id AND status = 'cancelled'"
    );
    $parentCodQuery->execute([':shipment_id' => $parentId]);
    assertShipmentTest((int) $parentCodQuery->fetchColumn() === 2, 'Parent COD transactions were not cancelled.');

    $passed = true;
} catch (Throwable $exception) {
    $failure = $exception;
} finally {
    if ($pdo instanceof PDO && is_int($testUserId)) {
        try {
            cleanupShipmentTestUser($pdo, $testUserId);
        } catch (Throwable $cleanupException) {
            $failure = new RuntimeException(
                'Shipment test cleanup failed: ' . $cleanupException->getMessage(),
                0,
                $failure ?? $cleanupException,
            );
            $passed = false;
        }
    }
}

if (!$passed || $failure !== null) {
    fwrite(STDERR, 'Shipment integration test failed: ' . ($failure?->getMessage() ?? 'unknown failure') . PHP_EOL);
    exit(1);
}

echo "Shipment integration checks passed: middleware, create/replay, tracking range, weights/pricing, COD/history, list/detail, priority conflict, print, cancel, and forward." . PHP_EOL;
