<?php

declare(strict_types=1);

$projectRoot = dirname(__DIR__);
spl_autoload_register(static function (string $class) use ($projectRoot): void {
    if (!str_starts_with($class, 'App\\')) {
        return;
    }

    $classPath = str_replace('\\', DIRECTORY_SEPARATOR, substr($class, 4));
    $filePath = $projectRoot . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . $classPath . '.php';
    if (is_file($filePath)) {
        require $filePath;
    }
});

use App\Core\ApiException;
use App\Core\Request;
use App\Modules\MasterData\Controllers\GeographyController;
use App\Modules\MasterData\Repositories\GeographyRepository;
use App\Modules\MasterData\Services\GeographyService;
use App\Modules\MasterData\Validators\GeographyQueryValidator;

function assertGeographyTest(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

/**
 * @param array<string, mixed> $query
 * @param array<string, string> $attributes
 */
function geographyRequest(array $query = [], array $attributes = []): Request
{
    $request = new Request(
        'GET',
        '/api/v1/public',
        $query,
        '',
        [],
        ['Accept' => 'application/json', 'X-Client-Type' => 'web_public'],
        null,
        'GeographyTest/1.0',
    );
    foreach ($attributes as $name => $value) {
        $request->setAttribute($name, $value);
    }

    return $request;
}

try {
    $pdo = new PDO('sqlite::memory:');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec(
        'CREATE TABLE provinces (
            id INTEGER PRIMARY KEY,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            region TEXT NOT NULL,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        'CREATE TABLE districts (
            id INTEGER PRIMARY KEY,
            province_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            is_remote_area INTEGER NOT NULL,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        'CREATE TABLE wards (
            id INTEGER PRIMARY KEY,
            district_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            is_active INTEGER NOT NULL
        )',
    );
    $pdo->exec(
        "INSERT INTO provinces VALUES
            (1, '01', 'Hà Nội', 'north', 1),
            (2, '48', 'Đà Nẵng', 'central', 1),
            (3, '99', 'Ngừng hoạt động', 'north', 0)",
    );
    $pdo->exec(
        "INSERT INTO districts VALUES
            (10, 2, '490', 'Hải Châu', 0, 1),
            (11, 1, '001', 'Ba Đình', 0, 1),
            (12, 2, '491', 'Địa giới ngừng hoạt động', 0, 0)",
    );
    $pdo->exec(
        "INSERT INTO wards VALUES
            (100, 10, '20194', 'Phường Hải Châu I', 1),
            (101, 11, '00001', 'Phường Phúc Xá', 1),
            (102, 10, '20195', 'Phường ngừng hoạt động', 0)",
    );

    $controller = new GeographyController(
        new GeographyService(new GeographyRepository($pdo)),
        new GeographyQueryValidator(),
    );

    $provinces = $controller->provinces(geographyRequest(['page' => '1', 'per_page' => '1']));
    $provincePayload = json_decode($provinces->body(), true, 512, JSON_THROW_ON_ERROR);
    assertGeographyTest($provinces->statusCode() === 200, 'Province list did not return HTTP 200.');
    assertGeographyTest(count($provincePayload['data']) === 1, 'Province pagination was not applied.');
    assertGeographyTest($provincePayload['data'][0]['id'] === 1, 'Province ordering is incorrect.');
    assertGeographyTest($provincePayload['meta']['pagination']['total'] === 2, 'Inactive provinces were included.');

    $province = $controller->province(geographyRequest([], ['route_params' => ['id' => '2']]));
    $provincePayload = json_decode($province->body(), true, 512, JSON_THROW_ON_ERROR);
    assertGeographyTest($provincePayload['data']['name'] === 'Đà Nẵng', 'Province detail did not return the row.');

    $districts = $controller->districts(geographyRequest(['province_id' => '2']));
    $districtPayload = json_decode($districts->body(), true, 512, JSON_THROW_ON_ERROR);
    assertGeographyTest(count($districtPayload['data']) === 1, 'District filtering returned the wrong rows.');
    assertGeographyTest($districtPayload['data'][0]['province_id'] === 2, 'District parent ID was not normalized.');

    $district = $controller->district(geographyRequest([], ['route_params' => ['id' => '10']]));
    $districtPayload = json_decode($district->body(), true, 512, JSON_THROW_ON_ERROR);
    assertGeographyTest($districtPayload['data']['is_remote_area'] === 0, 'District detail is incorrect.');

    $wards = $controller->wards(geographyRequest(['district_id' => '10']));
    $wardPayload = json_decode($wards->body(), true, 512, JSON_THROW_ON_ERROR);
    assertGeographyTest(count($wardPayload['data']) === 1, 'Ward filtering returned the wrong rows.');
    assertGeographyTest($wardPayload['data'][0]['district_id'] === 10, 'Ward parent ID was not normalized.');

    $ward = $controller->ward(geographyRequest([], ['route_params' => ['id' => '100']]));
    $wardPayload = json_decode($ward->body(), true, 512, JSON_THROW_ON_ERROR);
    assertGeographyTest($wardPayload['data']['name'] === 'Phường Hải Châu I', 'Ward detail is incorrect.');

    foreach ([
        static fn () => $controller->provinces(geographyRequest(['page' => '0'])),
        static fn () => $controller->provinces(geographyRequest(['page' => (string) PHP_INT_MAX])),
        static fn () => $controller->districts(geographyRequest(['province_id' => '1 OR 1=1'])),
        static fn () => $controller->wards(geographyRequest(['per_page' => '101'])),
        static fn () => $controller->province(geographyRequest([], ['route_params' => ['id' => '1 OR 1=1']])),
    ] as $invalidRequest) {
        try {
            $invalidRequest();
            throw new RuntimeException('An invalid geography query was accepted.');
        } catch (ApiException $exception) {
            assertGeographyTest(
                $exception->errorCode === '422_VALIDATION_ERROR',
                'Invalid geography input returned the wrong error.',
            );
        }
    }

    try {
        $controller->province(geographyRequest([], ['route_params' => ['id' => '999999']]));
        throw new RuntimeException('A missing province returned successfully.');
    } catch (ApiException $exception) {
        assertGeographyTest($exception->errorCode === '404_NOT_FOUND', 'Missing detail returned the wrong error.');
    }

    echo "Geography checks passed: 12 request scenarios including list/detail, pagination, parent filters, inactive filtering, invalid input and missing records." . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, 'Geography checks failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
