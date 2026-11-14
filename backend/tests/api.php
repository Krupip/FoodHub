<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

function expect(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }

    echo '[OK] ', $message, PHP_EOL;
}

function request(string $baseUrl, string $path, string $method = 'GET', ?string $body = null, string $contentType = 'application/json'): array
{
    $options = [
        'method' => $method,
        'header' => 'Content-Type: ' . $contentType,
        'ignore_errors' => true,
        'timeout' => 3,
    ];

    if ($body !== null) {
        $options['content'] = $body;
    }

    $http_response_header = [];
    $content = file_get_contents($baseUrl . $path, false, stream_context_create(['http' => $options]));

    if ($content === false || !isset($http_response_header[0])) {
        throw new RuntimeException('Tidak dapat menghubungi server pengujian.');
    }

    preg_match('/\s(\d{3})\s/', $http_response_header[0], $matches);

    return [
        'status' => (int) $matches[1],
        'headers' => $http_response_header,
        'body' => json_decode($content, true, 512, JSON_THROW_ON_ERROR),
    ];
}

function expectError(array $response, int $status, string $message): void
{
    expect(
        $response['status'] === $status
        && isset($response['body']['error'])
        && is_string($response['body']['error']),
        $message
    );
}

$routerPath = tempnam(sys_get_temp_dir(), 'foodhub-api-');
$log = tmpfile();
$server = null;
$exitCode = 0;

try {
    $backendPath = dirname(__DIR__);
    $router = '<?php require_once ' . var_export($backendPath . '/includes/bootstrap.php', true) . ';';
    $router .= '$categoriesPath = ' . var_export($backendPath . '/api/categories.php', true) . ';';
    $router .= <<<'PHP'

switch (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)) {
    case '/categories':
        require $categoriesPath;
        exit;
    case '/json':
        requireRequestMethod('POST');
        sendJsonResponse(['received' => readJsonBody()]);
    case '/created':
        sendJsonResponse(['message' => 'Berhasil dibuat: resep Nusantara ✓'], 201);
    case '/exception':
        throw new RuntimeException('DETAIL_INTERNAL_RAHASIA');
    case '/warning':
        trigger_error('DETAIL_INTERNAL_RAHASIA', E_USER_WARNING);
        break;
    case '/encoding':
        sendJsonResponse(['invalid' => "\xB1"]);
}

sendErrorResponse('Tidak ditemukan.', 404);
PHP;
    file_put_contents($routerPath, $router);

    $socket = stream_socket_server('tcp://127.0.0.1:0', $errorCode, $errorMessage);
    if ($socket === false) {
        throw new RuntimeException('Tidak dapat menyediakan port pengujian: ' . $errorMessage);
    }
    $address = stream_socket_get_name($socket, false);
    fclose($socket);

    $server = proc_open(
        [PHP_BINARY, '-S', $address, '-t', dirname($backendPath), $routerPath],
        [0 => ['pipe', 'r'], 1 => $log, 2 => $log],
        $pipes
    );
    if (!is_resource($server)) {
        throw new RuntimeException('Tidak dapat menjalankan PHP development server.');
    }
    fclose($pipes[0]);

    $ready = false;
    for ($attempt = 0; $attempt < 100; $attempt++) {
        $client = @stream_socket_client('tcp://' . $address, $errorCode, $errorMessage, 0.1);
        if ($client !== false) {
            fclose($client);
            $ready = true;
            break;
        }
        usleep(50000);
    }
    if (!$ready) {
        throw new RuntimeException('Server pengujian tidak siap dalam batas waktu.');
    }

    $baseUrl = 'http://' . $address;
    $response = request($baseUrl, '/categories');
    expect($response['status'] === 200 && isset($response['body']['categories']) && is_array($response['body']['categories']), 'GET kategori mengembalikan array dari database.');
    expect(in_array('Content-Type: application/json; charset=utf-8', $response['headers'], true), 'Respons menggunakan Content-Type JSON.');
    $previousId = 0;
    foreach ($response['body']['categories'] as $category) {
        if (!is_int($category['id']) || $category['id'] <= $previousId || !is_string($category['name']) || !is_string($category['slug'])) {
            throw new RuntimeException('Bentuk atau urutan kategori tidak sesuai.');
        }
        $previousId = $category['id'];
    }
    echo '[OK] Field kategori valid dan ID terurut (', count($response['body']['categories']), ' kategori).', PHP_EOL;

    foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
        $response = request($baseUrl, '/categories', $method, '{}');
        expectError($response, 405, $method . ' kategori ditolak.');
        expect(in_array('Allow: GET', $response['headers'], true), 'Header Allow menyebut GET.');
    }

    $payload = ['name' => 'Soto Nusantara ✓', 'ingredients' => [['name' => 'Garam', 'quantity' => null]]];
    $response = request($baseUrl, '/json', 'POST', json_encode($payload, JSON_THROW_ON_ERROR), 'application/json; charset=UTF-8');
    expect($response['status'] === 200 && $response['body']['received'] === $payload, 'Body JSON Unicode dan data nested terbaca.');
    $response = request($baseUrl, '/json', 'POST', '{}');
    expect($response['status'] === 200 && $response['body']['received'] === [], 'Objek JSON kosong diterima.');
    expectError(request($baseUrl, '/json', 'POST', '{}', 'text/plain'), 415, 'Content-Type selain JSON ditolak.');
    expectError(request($baseUrl, '/json', 'POST', ''), 400, 'Body kosong ditolak.');
    expectError(request($baseUrl, '/json', 'POST', '{"name":'), 400, 'JSON rusak ditolak.');
    foreach (['[]', '[1]', 'null', '123', '"teks"', 'true'] as $body) {
        expectError(request($baseUrl, '/json', 'POST', $body), 400, 'Body bukan objek ditolak: ' . $body);
    }
    $response = request($baseUrl, '/created');
    expect($response['status'] === 201 && $response['body']['message'] === 'Berhasil dibuat: resep Nusantara ✓', 'Helper mendukung status 201 dan teks Unicode.');
    foreach (['/exception', '/warning', '/encoding'] as $path) {
        $response = request($baseUrl, $path);
        expectError($response, 500, 'Error internal menghasilkan JSON 500: ' . $path);
        expect($response['body'] === ['error' => 'Terjadi kesalahan pada server. Silakan coba lagi nanti.'], 'Detail internal tidak bocor: ' . $path);
    }

    echo 'Semua pengujian lulus; tidak ada data database yang diubah.', PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, '[GAGAL] ' . $exception->getMessage() . PHP_EOL);
    $exitCode = 1;
} finally {
    if (is_resource($server)) {
        proc_terminate($server);
        proc_close($server);
    }
    if ($exitCode !== 0 && is_resource($log)) {
        rewind($log);
        fwrite(STDERR, stream_get_contents($log));
    }
    if (is_resource($log)) {
        fclose($log);
    }
    if ($routerPath !== false && is_file($routerPath)) {
        unlink($routerPath);
    }
}

exit($exitCode);
