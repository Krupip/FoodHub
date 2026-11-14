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

function request(string $baseUrl, string $path, string $method = 'GET', ?string $body = null, string $contentType = 'application/json', string $cookie = ''): array
{
    $options = [
        'method' => $method,
        'header' => 'Content-Type: ' . $contentType . ($cookie !== '' ? "\r\nCookie: " . $cookie : ''),
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

function sessionCookie(array $response): string
{
    foreach ($response['headers'] as $header) {
        if (stripos($header, 'Set-Cookie: foodhub_session=') === 0) {
            return explode(';', substr($header, strlen('Set-Cookie: ')))[0];
        }
    }

    throw new RuntimeException('Cookie sesi tidak ditemukan.');
}

$routerPath = tempnam(sys_get_temp_dir(), 'foodhub-api-');
$log = tmpfile();
$server = null;
$testPdo = null;
$sessionDirectory = null;
$testPrefix = 'foodhub-test-' . bin2hex(random_bytes(16));
$testEmails = [$testPrefix . '@example.test', $testPrefix . '-boundary@example.test'];
$exitCode = 0;

try {
    $backendPath = dirname(__DIR__);
    require_once $backendPath . '/config/database.php';
    $testPdo = getDatabaseConnection();
    $sessionDirectory = sys_get_temp_dir() . '/foodhub-sessions-' . bin2hex(random_bytes(8));
    mkdir($sessionDirectory, 0700);

    $router = '<?php require_once ' . var_export($backendPath . '/includes/bootstrap.php', true) . ';';
    $router .= '$categoriesPath = ' . var_export($backendPath . '/api/categories.php', true) . ';';
    $router .= '$authPath = ' . var_export($backendPath . '/api/auth.php', true) . ';';
    $router .= <<<'PHP'

switch (parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)) {
    case '/auth':
        require $authPath;
        exit;
    case '/seed-session':
        startUserSession();
        $_SESSION['legacy'] = true;
        sendJsonResponse(['session_id' => session_id()]);
    case '/session':
        startUserSession();
        sendJsonResponse(['session' => $_SESSION]);
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
        [PHP_BINARY, '-d', 'session.save_path=' . $sessionDirectory, '-S', $address, '-t', dirname($backendPath), $routerPath],
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

    expectError(request($baseUrl, '/auth?action=register'), 405, 'Registrasi hanya menerima POST.');
    expectError(request($baseUrl, '/auth?action=unknown', 'POST', '{}'), 404, 'Aksi autentikasi tidak dikenal ditolak.');
    expectError(request($baseUrl, '/auth?action[]=register', 'POST', '{}'), 404, 'Aksi autentikasi berbentuk array ditolak tanpa error internal.');
    expectError(request($baseUrl, '/auth?action=register', 'POST', '{}', 'text/plain'), 415, 'Registrasi mensyaratkan Content-Type JSON.');
    expectError(request($baseUrl, '/auth?action=register', 'POST', '{'), 400, 'Registrasi menolak JSON rusak.');
    expectError(request($baseUrl, '/auth?action=register', 'POST', '[]'), 400, 'Registrasi menolak body bukan objek.');
    expectError(request($baseUrl, '/auth?action=register', 'POST', '{}'), 422, 'Registrasi menolak field wajib yang tidak tersedia.');

    $registration = ['name' => '  Pengguna Uji ✓  ', 'email' => '  ' . strtoupper($testEmails[0]) . '  ', 'password' => ' password aman 123 '];
    $invalidInputs = [
        'nama terlalu pendek' => ['name' => ' ab '],
        'nama terlalu panjang' => ['name' => str_repeat('界', 101)],
        'nama bukan teks' => ['name' => ['admin']],
        'email tidak valid' => ['email' => 'bukan-email'],
        'email terlalu panjang' => ['email' => str_repeat('a', 60) . '@' . str_repeat('b', 60) . '.' . str_repeat('c', 30)],
        'email bukan teks' => ['email' => 123],
        'password terlalu pendek' => ['password' => '1234567'],
        'password lebih dari 72 byte' => ['password' => str_repeat('a', 73)],
        'password multibyte lebih dari 72 byte' => ['password' => str_repeat('界', 25)],
        'password mengandung null' => ['password' => "password\0aman"],
        'password bukan teks' => ['password' => ['password123']],
    ];
    foreach ($invalidInputs as $description => $overrides) {
        $body = json_encode(array_replace($registration, $overrides), JSON_THROW_ON_ERROR);
        expectError(request($baseUrl, '/auth?action=register', 'POST', $body), 422, 'Registrasi menolak ' . $description . '.');
    }
    foreach (['name', 'email', 'password'] as $field) {
        $input = $registration;
        unset($input[$field]);
        expectError(request($baseUrl, '/auth?action=register', 'POST', json_encode($input, JSON_THROW_ON_ERROR)), 422, 'Field wajib diperiksa: ' . $field);
    }
    $stmt = $testPdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
    $stmt->execute([$testEmails[0]]);
    expect((int) $stmt->fetchColumn() === 0, 'Input registrasi tidak valid tidak membuat akun.');

    $seed = request($baseUrl, '/seed-session');
    $oldCookie = sessionCookie($seed);
    $registration['role'] = 'admin';
    $registration['id'] = 1;
    $response = request($baseUrl, '/auth?action=register', 'POST', json_encode($registration, JSON_THROW_ON_ERROR), 'application/json', $oldCookie);
    expect($response['status'] === 201 && isset($response['body']['user']), 'Registrasi valid menghasilkan user dan status 201.');
    $user = $response['body']['user'];
    expect(is_int($user['id']) && $user['id'] > 0 && $user['name'] === trim($registration['name']) && $user['email'] === $testEmails[0] && $user['role'] === 'member', 'Nama/email dinormalisasi dan role dari klien tidak dipercaya.');
    expect(array_keys($user) === ['id', 'name', 'email', 'role'], 'Respons tidak mengandung password atau hash.');
    $cookie = sessionCookie($response);
    expect($cookie !== $oldCookie, 'ID sesi diregenerasi saat registrasi.');
    $cookieHeaders = implode("\n", $response['headers']);
    expect(stripos($cookieHeaders, 'HttpOnly') !== false && stripos($cookieHeaders, 'SameSite=Lax') !== false, 'Cookie sesi menggunakan HttpOnly dan SameSite=Lax.');

    $stmt = $testPdo->prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = ?');
    $stmt->execute([$testEmails[0]]);
    $storedUser = $stmt->fetch();
    expect($storedUser !== false && (int) $storedUser['id'] === $user['id'] && $storedUser['role'] === 'member', 'Akun tersimpan sebagai member di database.');
    expect($storedUser['password_hash'] !== $registration['password'] && password_verify($registration['password'], $storedUser['password_hash']), 'Password di-hash dan spasi password tidak dihapus.');
    $session = request($baseUrl, '/session', 'GET', null, 'application/json', $cookie);
    expect($session['status'] === 200 && $session['body']['session'] === ['user_id' => $user['id']], 'Sesi login otomatis bertahan pada request berikutnya tanpa data sesi lama.');
    $oldSession = request($baseUrl, '/session', 'GET', null, 'application/json', $oldCookie);
    expect(!isset($oldSession['body']['session']['user_id']), 'Cookie sesi lama tidak dapat mengakses sesi login baru.');

    $duplicate = request($baseUrl, '/auth?action=register', 'POST', json_encode($registration, JSON_THROW_ON_ERROR), 'application/json', $cookie);
    expectError($duplicate, 409, 'Email duplikat ditolak dengan status 409.');
    $stmt = $testPdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
    $stmt->execute([$testEmails[0]]);
    expect((int) $stmt->fetchColumn() === 1, 'Request duplikat tidak membuat akun kedua.');
    $cookie = sessionCookie($duplicate);
    $session = request($baseUrl, '/session', 'GET', null, 'application/json', $cookie);
    expect(($session['body']['session']['user_id'] ?? null) === $user['id'], 'Registrasi gagal tidak mengganti identitas pengguna aktif.');

    $boundary = ['name' => str_repeat('界', 100), 'email' => $testEmails[1], 'password' => str_repeat('a', 72)];
    $response = request($baseUrl, '/auth?action=register', 'POST', json_encode($boundary, JSON_THROW_ON_ERROR));
    expect($response['status'] === 201 && $response['body']['user']['name'] === $boundary['name'], 'Nama Unicode 100 karakter dan password 72 byte diterima.');

    $response = request($baseUrl, '/auth?action=login');
    expectError($response, 405, 'Login hanya menerima POST.');
    expect(in_array('Allow: POST', $response['headers'], true), 'Login mengirim header Allow: POST.');
    expectError(request($baseUrl, '/auth?action=login', 'POST', '{}', 'text/plain'), 415, 'Login mensyaratkan Content-Type JSON.');
    expectError(request($baseUrl, '/auth?action=login', 'POST', '{'), 400, 'Login menolak JSON rusak.');
    expectError(request($baseUrl, '/auth?action=login', 'POST', '[]'), 400, 'Login menolak body bukan objek.');
    expectError(request($baseUrl, '/auth?action=login', 'POST', '{}'), 422, 'Login menolak field wajib yang tidak tersedia.');

    $login = ['email' => $registration['email'], 'password' => $registration['password']];
    $invalidLogins = [
        'email kosong' => ['email' => '  '],
        'email tidak valid' => ['email' => 'bukan-email'],
        'email terlalu panjang' => ['email' => str_repeat('a', 60) . '@' . str_repeat('b', 60) . '.' . str_repeat('c', 30)],
        'email bukan teks' => ['email' => ['admin@example.test']],
        'email null' => ['email' => null],
        'password kosong' => ['password' => ''],
        'password lebih dari 72 byte' => ['password' => str_repeat('a', 73)],
        'password multibyte lebih dari 72 byte' => ['password' => str_repeat('界', 25)],
        'password mengandung null' => ['password' => "password\0aman"],
        'password bukan teks' => ['password' => 12345678],
        'password null' => ['password' => null],
        'remember berupa teks' => ['remember' => 'false'],
        'remember berupa angka' => ['remember' => 1],
        'remember berupa array' => ['remember' => []],
        'remember null' => ['remember' => null],
    ];
    foreach ($invalidLogins as $description => $overrides) {
        $body = json_encode(array_replace($login, $overrides), JSON_THROW_ON_ERROR);
        expectError(request($baseUrl, '/auth?action=login', 'POST', $body), 422, 'Login menolak ' . $description . '.');
    }
    foreach (['email', 'password'] as $field) {
        $input = $login;
        unset($input[$field]);
        expectError(request($baseUrl, '/auth?action=login', 'POST', json_encode($input, JSON_THROW_ON_ERROR)), 422, 'Field login wajib diperiksa: ' . $field);
    }

    $wrongPassword = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['password' => 'salah']), JSON_THROW_ON_ERROR));
    $unknownEmail = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['email' => $testPrefix . '-missing@example.test']), JSON_THROW_ON_ERROR));
    expectError($wrongPassword, 401, 'Password salah ditolak dengan 401, bukan aturan panjang registrasi.');
    expectError($unknownEmail, 401, 'Email tidak terdaftar ditolak dengan 401.');
    expect($wrongPassword['body'] === ['error' => 'Email atau kata sandi salah.'] && $unknownEmail['body'] === $wrongPassword['body'], 'Pesan kredensial salah tidak membocorkan keberadaan email.');
    foreach ([$wrongPassword, $unknownEmail] as $failedLogin) {
        expect(stripos(implode("\n", $failedLogin['headers']), 'Set-Cookie:') === false, 'Login gagal tanpa sesi tidak membuat cookie login.');
    }

    $seed = request($baseUrl, '/seed-session');
    $oldLoginCookie = sessionCookie($seed);
    $login['role'] = 'admin';
    $login['user_id'] = 1;
    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($login, JSON_THROW_ON_ERROR), 'application/json', $oldLoginCookie);
    expect($response['status'] === 200 && $response['body'] === ['user' => $user], 'Login member berhasil; ID dan role berasal dari database, bukan input.');
    expect(!array_key_exists('password', $response['body']['user']) && !array_key_exists('password_hash', $response['body']['user']), 'Respons login tidak menyertakan password atau hash.');
    $loginCookie = sessionCookie($response);
    expect($loginCookie !== $oldLoginCookie, 'ID sesi diregenerasi setelah verifikasi login berhasil.');
    $headers = implode("\n", $response['headers']);
    expect(stripos($headers, 'HttpOnly') !== false && stripos($headers, 'SameSite=Lax') !== false, 'Cookie login memakai HttpOnly dan SameSite=Lax.');
    expect(stripos($headers, 'expires=') === false && stripos($headers, 'Max-Age=') === false, 'Login tanpa remember menggunakan cookie sesi nonpersisten.');
    $session = request($baseUrl, '/session', 'GET', null, 'application/json', $loginCookie);
    expect($session['body']['session'] === ['user_id' => $user['id']], 'Login menyimpan hanya user_id dan menghapus data sesi lama.');
    $oldSession = request($baseUrl, '/session', 'GET', null, 'application/json', $oldLoginCookie);
    expect(!isset($oldSession['body']['session']['user_id']), 'Cookie lama tidak dapat mengakses sesi login baru.');

    $failedWithSession = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['email' => $testEmails[1], 'password' => 'salah']), JSON_THROW_ON_ERROR), 'application/json', $loginCookie);
    expectError($failedWithSession, 401, 'Kredensial salah tetap ditolak meskipun browser sudah memiliki sesi.');
    $session = request($baseUrl, '/session', 'GET', null, 'application/json', $loginCookie);
    expect($session['body']['session'] === ['user_id' => $user['id']], 'Login gagal tidak mengganti identitas sesi aktif.');
    $trimmedPassword = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['password' => trim($login['password'])]), JSON_THROW_ON_ERROR));
    expectError($trimmedPassword, 401, 'Spasi password tidak dihapus saat verifikasi login.');

    foreach ([false, true] as $remember) {
        $response = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['remember' => $remember]), JSON_THROW_ON_ERROR));
        expect($response['status'] === 200 && $response['body'] === ['user' => $user], 'Login menerima boolean remember=' . ($remember ? 'true' : 'false') . '.');
        $headers = implode("\n", $response['headers']);
        expect(stripos($headers, 'expires=') === false && stripos($headers, 'Max-Age=') === false, 'Remember belum menerbitkan cookie login persisten.');
    }

    // Hanya akun acak milik pengujian yang diubah; akun admin asli tidak disentuh.
    $stmt = $testPdo->prepare("UPDATE users SET role = 'admin' WHERE email = ?");
    $stmt->execute([$testEmails[1]]);
    $adminLogin = ['email' => $testEmails[1], 'password' => $boundary['password'], 'role' => 'member'];
    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($adminLogin, JSON_THROW_ON_ERROR));
    expect($response['status'] === 200 && $response['body']['user']['role'] === 'admin' && $response['body']['user']['name'] === $boundary['name'], 'Login admin dan password 72 byte berhasil memakai data database.');
    $adminId = $response['body']['user']['id'];
    $adminSession = request($baseUrl, '/session', 'GET', null, 'application/json', sessionCookie($response));
    expect($adminSession['body']['session'] === ['user_id' => $adminId], 'Sesi login admin berisi ID akun yang benar.');
    $stmt = $testPdo->prepare('SELECT password_hash FROM users WHERE email = ?');
    $stmt->execute([$testEmails[0]]);
    expect($stmt->fetchColumn() === $storedUser['password_hash'], 'Login tidak mengubah hash password yang sudah tersimpan.');

    echo 'Semua pengujian lulus; akun dan sesi khusus pengujian dibersihkan setelah selesai.', PHP_EOL;
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
    if ($testPdo instanceof PDO) {
        try {
            $stmt = $testPdo->prepare('DELETE FROM users WHERE email IN (?, ?)');
            $stmt->execute($testEmails);
        } catch (Throwable $exception) {
            fwrite(STDERR, '[GAGAL] Pembersihan akun uji: ' . $exception->getMessage() . PHP_EOL);
            $exitCode = 1;
        }
    }
    if ($sessionDirectory !== null && is_dir($sessionDirectory)) {
        foreach (glob($sessionDirectory . '/sess_*') ?: [] as $sessionFile) {
            unlink($sessionFile);
        }
        rmdir($sessionDirectory);
    }
}

exit($exitCode);
