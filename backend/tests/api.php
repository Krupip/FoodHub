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

function request(string $baseUrl, string $path, string $method = 'GET', ?string $body = null, string $contentType = 'application/json', string $cookie = '', array $extraHeaders = []): array
{
    $headers = ['Content-Type: ' . $contentType];
    if ($cookie !== '') {
        $headers[] = 'Cookie: ' . $cookie;
    }
    foreach ($extraHeaders as $name => $value) {
        $headers[] = $name . ': ' . $value;
    }
    $options = [
        'method' => $method,
        'header' => implode("\r\n", $headers),
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
        'body' => $method === 'HEAD' && $content === '' ? null : json_decode($content, true, 512, JSON_THROW_ON_ERROR),
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

function responseCsrfToken(array $response): string
{
    $tokens = [];
    foreach ($response['headers'] as $header) {
        if (stripos($header, 'X-CSRF-Token:') === 0) {
            $tokens[] = trim(substr($header, strlen('X-CSRF-Token:')));
        }
    }
    expect(count($tokens) === 1 && preg_match('/\A[a-f0-9]{64}\z/', $tokens[0]) === 1, 'Header CSRF tunggal berformat 64 hex lowercase.');
    return $tokens[0];
}

function expectNoAuthHeaders(array $response, string $message): void
{
    $headers = implode("\n", $response['headers']);
    expect(stripos($headers, 'Set-Cookie:') === false && stripos($headers, 'X-CSRF-Token:') === false, $message);
}

function expectAnonymousGuard(array $response, string $message): void
{
    expectError($response, 401, $message);
    expectNoAuthHeaders($response, $message . ' Tanpa Set-Cookie atau token CSRF anonim.');
}

function responseCookie(array $response, string $name): string
{
    $cookie = null;
    foreach ($response['headers'] as $header) {
        if (stripos($header, 'Set-Cookie: ' . $name . '=') === 0) {
            $cookie = explode(';', substr($header, strlen('Set-Cookie: ')))[0];
        }
    }

    if ($cookie === null) {
        throw new RuntimeException('Cookie tidak ditemukan: ' . $name);
    }
    return $cookie;
}

function sessionCookie(array $response): string
{
    return responseCookie($response, 'foodhub_session');
}

function rememberSelector(string $cookie): string
{
    return explode(':', rawurldecode(explode('=', $cookie, 2)[1]))[0];
}

function applyResponseCookies(array &$jar, array $response): void
{
    foreach ($response['headers'] as $header) {
        if (preg_match('/^Set-Cookie:\s*([^=;\s]+)=([^;]*)/i', $header, $matches) !== 1) {
            continue;
        }
        if (stripos($header, 'Max-Age=0') !== false) {
            unset($jar[$matches[1]]);
        } else {
            $jar[$matches[1]] = $matches[1] . '=' . $matches[2];
        }
    }
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
    $router .= '$recipesPath = ' . var_export($backendPath . '/api/recipes.php', true) . ';';
    $guardedPaths = [
        '/api/profile.php' => $backendPath . '/api/profile.php',
        '/api/favorites.php' => $backendPath . '/api/favorites.php',
        '/api/reviews.php' => $backendPath . '/api/reviews.php',
        '/api/admin/recipes.php' => $backendPath . '/api/admin/recipes.php',
        '/api/admin/users.php' => $backendPath . '/api/admin/users.php',
        '/api/admin/stats.php' => $backendPath . '/api/admin/stats.php',
    ];
    $router .= '$guardedPaths = ' . var_export($guardedPaths, true) . ';';
    $router .= <<<'PHP'

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (isset($guardedPaths[$path])) {
    require $guardedPaths[$path];
    exit;
}

switch ($path) {
    case '/auth':
        require $authPath;
        exit;
    case '/recipes':
        require $recipesPath;
        exit;
    case '/protected/member':
    case '/protected/admin':
        $user = $path === '/protected/admin' ? requireAdmin() : requireLogin();
        requireCsrfForMutation();
        session_write_close();
        sendJsonResponse(['user' => $user]);
    case '/seed-session':
        startUserSession();
        $_SESSION['legacy'] = true;
        publishCsrfToken();
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
    $response = request($baseUrl, '/auth?action=me');
    expect($response['status'] === 200 && $response['body'] === ['user' => null], 'Pengunjung anonim mendapat user null, bukan error.');
    expectNoAuthHeaders($response, 'Me anonim tidak menerbitkan cookie atau token CSRF.');
    $protectedPaths = array_merge(['/protected/member', '/protected/admin'], array_keys($guardedPaths));
    foreach ($protectedPaths as $path) {
        foreach (['GET', 'POST'] as $method) {
            $response = request($baseUrl, $path . '?role=admin&id=1&user_id=1', $method, $method === 'POST' ? '{"role":"admin","id":1,"user_id":1}' : null);
            expectAnonymousGuard($response, $method . ' anonim/identitas palsu ditolak guard: ' . $path);
        }
    }
    $response = request($baseUrl, '/auth?action=me', 'POST', '{}');
    expectError($response, 405, 'Me hanya menerima GET.');
    expect(in_array('Allow: GET', $response['headers'], true), 'Me mengirim Allow: GET.');
    expectError(request($baseUrl, '/auth?action=logout'), 405, 'Logout menolak GET.');
    expectError(request($baseUrl, '/auth?action=logout', 'POST', '{}', 'application/x-www-form-urlencoded'), 415, 'Logout menolak form lintas situs.');
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
    $seedCsrf = responseCsrfToken($seed);
    $registration['role'] = 'admin';
    $registration['id'] = 1;
    $response = request($baseUrl, '/auth?action=register', 'POST', json_encode($registration, JSON_THROW_ON_ERROR), 'application/json', $oldCookie);
    expect($response['status'] === 201 && isset($response['body']['user']), 'Registrasi valid menghasilkan user dan status 201.');
    $user = $response['body']['user'];
    expect(is_int($user['id']) && $user['id'] > 0 && $user['name'] === trim($registration['name']) && $user['email'] === $testEmails[0] && $user['role'] === 'member', 'Nama/email dinormalisasi dan role dari klien tidak dipercaya.');
    expect(array_keys($user) === ['id', 'name', 'email', 'role'], 'Respons user tidak mengandung password, hash, atau token CSRF.');
    $registrationCsrf = responseCsrfToken($response);
    expect($registrationCsrf !== $seedCsrf, 'Registrasi publik tanpa header CSRF merotasi token sesi lama.');
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
    expect($session['status'] === 200 && $session['body']['session'] === ['user_id' => $user['id'], 'csrf_token' => $registrationCsrf], 'Sesi registrasi hanya menyimpan identitas yang benar dan CSRF valid, tanpa data lama.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $cookie);
    expect($me['status'] === 200 && $me['body'] === ['user' => $user], 'Me mengenali sesi registrasi lewat endpoint publik.');
    expect(responseCsrfToken($me) === $registrationCsrf, 'Me mempertahankan token CSRF sesi registrasi.');
    $oldSession = request($baseUrl, '/session', 'GET', null, 'application/json', $oldCookie);
    expect(!isset($oldSession['body']['session']['user_id']), 'Cookie sesi lama tidak dapat mengakses sesi login baru.');

    $duplicate = request($baseUrl, '/auth?action=register', 'POST', json_encode($registration, JSON_THROW_ON_ERROR), 'application/json', $cookie);
    expectError($duplicate, 409, 'Email duplikat ditolak dengan status 409.');
    $stmt = $testPdo->prepare('SELECT COUNT(*) FROM users WHERE email = ?');
    $stmt->execute([$testEmails[0]]);
    expect((int) $stmt->fetchColumn() === 1, 'Request duplikat tidak membuat akun kedua.');
    $cookie = sessionCookie($duplicate);
    $session = request($baseUrl, '/session', 'GET', null, 'application/json', $cookie);
    expect($session['body']['session'] === ['user_id' => $user['id'], 'csrf_token' => $registrationCsrf], 'Registrasi gagal tidak mengganti identitas atau token CSRF pengguna aktif.');

    $boundary = ['name' => str_repeat('界', 100), 'email' => $testEmails[1], 'password' => str_repeat('a', 72)];
    $response = request($baseUrl, '/auth?action=register', 'POST', json_encode($boundary, JSON_THROW_ON_ERROR));
    expect($response['status'] === 201 && $response['body']['user']['name'] === $boundary['name'], 'Nama Unicode 100 karakter dan password 72 byte diterima.');
    $boundaryCookie = sessionCookie($response);
    $boundaryUser = $response['body']['user'];
    expect(array_keys($boundaryUser) === ['id', 'name', 'email', 'role'] && $boundaryUser['email'] === $testEmails[1] && $boundaryUser['role'] === 'member', 'Registrasi kedua tetap mengembalikan identitas member tanpa token di JSON.');
    $boundaryCsrf = responseCsrfToken($response);
    expect($boundaryCsrf !== $registrationCsrf, 'Dua sesi registrasi memiliki token CSRF berbeda.');

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
    $oldLoginCsrf = responseCsrfToken($seed);
    $login['role'] = 'admin';
    $login['user_id'] = 1;
    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($login, JSON_THROW_ON_ERROR), 'application/json', $oldLoginCookie);
    expect($response['status'] === 200 && $response['body'] === ['user' => $user], 'Login member berhasil; ID dan role berasal dari database, bukan input.');
    expect(array_keys($response['body']['user']) === ['id', 'name', 'email', 'role'], 'Respons login tidak menyertakan password, hash, atau CSRF.');
    $loginCsrf = responseCsrfToken($response);
    expect($loginCsrf !== $oldLoginCsrf && $loginCsrf !== $registrationCsrf, 'Login publik tanpa header CSRF merotasi token dan tidak berbagi token antar sesi akun yang sama.');
    $loginCookie = sessionCookie($response);
    expect($loginCookie !== $oldLoginCookie, 'ID sesi diregenerasi setelah verifikasi login berhasil.');
    $headers = implode("\n", $response['headers']);
    expect(stripos($headers, 'HttpOnly') !== false && stripos($headers, 'SameSite=Lax') !== false, 'Cookie login memakai HttpOnly dan SameSite=Lax.');
    expect(stripos($headers, 'expires=') === false && stripos($headers, 'Max-Age=') === false, 'Login tanpa remember menggunakan cookie sesi nonpersisten.');
    $session = request($baseUrl, '/session', 'GET', null, 'application/json', $loginCookie);
    expect($session['body']['session'] === ['user_id' => $user['id'], 'csrf_token' => $loginCsrf], 'Login menyimpan hanya user_id dan CSRF valid, tanpa data sesi lama.');
    $oldSession = request($baseUrl, '/session', 'GET', null, 'application/json', $oldLoginCookie);
    expect(!isset($oldSession['body']['session']['user_id']), 'Cookie lama tidak dapat mengakses sesi login baru.');

    $failedWithSession = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['email' => $testEmails[1], 'password' => 'salah']), JSON_THROW_ON_ERROR), 'application/json', $loginCookie);
    expectError($failedWithSession, 401, 'Kredensial salah tetap ditolak meskipun browser sudah memiliki sesi.');
    $session = request($baseUrl, '/session', 'GET', null, 'application/json', $loginCookie);
    expect($session['body']['session'] === ['user_id' => $user['id'], 'csrf_token' => $loginCsrf], 'Login gagal tidak mengganti identitas atau CSRF sesi aktif.');
    $trimmedPassword = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['password' => trim($login['password'])]), JSON_THROW_ON_ERROR));
    expectError($trimmedPassword, 401, 'Spasi password tidak dihapus saat verifikasi login.');

    foreach ([false, true] as $remember) {
        $response = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['remember' => $remember]), JSON_THROW_ON_ERROR));
        expect($response['status'] === 200 && $response['body'] === ['user' => $user], 'Login menerima boolean remember=' . ($remember ? 'true' : 'false') . '.');
        responseCsrfToken($response);
        $headers = implode("\n", $response['headers']);
        if ($remember) {
            expect(stripos($headers, 'foodhub_remember=') !== false && stripos($headers, 'Max-Age=2592000') !== false, 'Remember membuat cookie token persisten 30 hari.');
        } else {
            expect(stripos($headers, 'expires=') === false && stripos($headers, 'Max-Age=') === false, 'Login tanpa remember tetap memakai cookie sesi biasa.');
        }
    }

    // Hanya akun acak milik pengujian yang diubah; akun admin asli tidak disentuh.
    $stmt = $testPdo->prepare("UPDATE users SET role = 'admin' WHERE email = ?");
    $stmt->execute([$testEmails[1]]);
    $adminLogin = ['email' => $testEmails[1], 'password' => $boundary['password'], 'role' => 'member'];
    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($adminLogin, JSON_THROW_ON_ERROR));
    expect($response['status'] === 200 && $response['body']['user']['role'] === 'admin' && $response['body']['user']['name'] === $boundary['name'], 'Login admin dan password 72 byte berhasil memakai data database.');
    $adminUser = array_replace($boundaryUser, ['role' => 'admin']);
    expect($response['body'] === ['user' => $adminUser], 'Login admin mengembalikan tepat identitas database tanpa hash atau CSRF di JSON.');
    $adminId = $adminUser['id'];
    $adminCsrf = responseCsrfToken($response);
    $adminCookie = sessionCookie($response);
    $adminSession = request($baseUrl, '/session', 'GET', null, 'application/json', $adminCookie);
    expect($adminSession['body']['session'] === ['user_id' => $adminId, 'csrf_token' => $adminCsrf], 'Sesi login admin berisi tepat ID akun yang benar dan token CSRF valid.');
    $stmt = $testPdo->prepare('SELECT password_hash FROM users WHERE email = ?');
    $stmt->execute([$testEmails[0]]);
    expect($stmt->fetchColumn() === $storedUser['password_hash'], 'Login tidak mengubah hash password yang sudah tersimpan.');

    echo '--- Guard dan CSRF nomor 9: HTTP langsung ke helper dan enam file API asli ---', PHP_EOL;
    $guardUsers = $testPdo->prepare('SELECT id, name, email, password_hash, role FROM users WHERE id IN (?, ?) ORDER BY id');
    $guardUsers->execute([$user['id'], $adminId]);
    $usersBeforeGuards = $guardUsers->fetchAll();
    $guardTokens = $testPdo->prepare('SELECT selector, user_id, token_hash, expires_at FROM remember_tokens WHERE user_id IN (?, ?) ORDER BY selector');
    $guardTokens->execute([$user['id'], $adminId]);
    $tokensBeforeGuards = $guardTokens->fetchAll();

    $adminPaths = ['/protected/admin', '/api/admin/recipes.php', '/api/admin/users.php', '/api/admin/stats.php'];
    foreach ($adminPaths as $path) {
        $denied = request($baseUrl, $path . '?role=admin&id=' . $adminId . '&user_id=' . $adminId, 'GET', null, 'application/json', $loginCookie);
        expectError($denied, 403, 'Member tidak menjadi admin lewat query: ' . $path);
        expect(responseCsrfToken($denied) === $loginCsrf, 'Guard admin yang menolak tetap menerbitkan CSRF sesi member.');
        foreach ([[], ['X-CSRF-Token' => $loginCsrf]] as $csrfHeaders) {
            $forged = json_encode(['role' => 'admin', 'id' => $adminId, 'user_id' => $adminId], JSON_THROW_ON_ERROR);
            $deniedPost = request($baseUrl, $path . '?role=admin&id=' . $adminId, 'POST', $forged, 'application/json', $loginCookie, $csrfHeaders);
            expectError($deniedPost, 403, 'Member dengan body/query role dan ID palsu ditolak: ' . $path);
            expect($deniedPost['body'] === $denied['body'], 'Otorisasi admin berjalan sebelum validasi CSRF: ' . $path);
        }
    }

    $allowedCases = [
        ['/protected/member', $loginCookie, $loginCsrf, $user, 200],
        ['/protected/member', $adminCookie, $adminCsrf, $adminUser, 200],
        ['/protected/admin', $adminCookie, $adminCsrf, $adminUser, 200],
    ];
    $stubPaths = array_diff(array_keys($guardedPaths), ['/api/profile.php', '/api/favorites.php', '/api/reviews.php', '/api/admin/recipes.php']);
    foreach ($stubPaths as $path) {
        if (str_starts_with($path, '/api/admin/')) {
            $allowedCases[] = [$path, $adminCookie, $adminCsrf, $adminUser, 501];
        } else {
            $allowedCases[] = [$path, $loginCookie, $loginCsrf, $user, 501];
            $allowedCases[] = [$path, $adminCookie, $adminCsrf, $adminUser, 501];
        }
    }
    foreach ($allowedCases as [$path, $allowedCookie, $csrf, $identity, $allowedStatus]) {
        $label = $identity['role'] . ' ' . $path;
        foreach (['GET', 'HEAD', 'OPTIONS'] as $method) {
            $allowed = request($baseUrl, $path, $method, null, 'application/json', $allowedCookie);
            expect($allowed['status'] === $allowedStatus, $method . ' aman tanpa CSRF mencapai ' . $allowedStatus . ': ' . $label);
            expect(responseCsrfToken($allowed) === $csrf, 'Guard menerbitkan CSRF stabil: ' . $label);
            if ($method === 'HEAD') {
                expect($allowed['body'] === null, 'HEAD tidak mengirim body: ' . $label);
            } elseif ($allowedStatus === 200) {
                expect($allowed['body'] === ['user' => $identity], 'Helper mengembalikan tepat user database, tanpa hash/CSRF: ' . $label);
            } else {
                expectError($allowed, 501, 'File stub asli tetap belum CRUD, bukan sukses 200: ' . $label);
                expect(array_keys($allowed['body']) === ['error'], 'Stub tidak membocorkan user atau token ke JSON: ' . $label);
            }
        }

        $otherId = $identity['id'] === $user['id'] ? $adminId : $user['id'];
        $forgedBody = json_encode(['role' => 'admin', 'id' => $otherId, 'user_id' => $otherId, 'csrf_token' => $csrf], JSON_THROW_ON_ERROR);
        $mutationPath = $path . '?role=admin&id=' . $otherId . '&csrf_token=' . $csrf;
        $foreignCsrf = $identity['id'] === $adminId ? $boundaryCsrf : $registrationCsrf;
        $invalidCsrfHeaders = [
            'hilang walau token ada di body/query' => [],
            'false/bukan hex' => ['X-CSRF-Token' => 'false'],
            'salah tetapi 64 hex' => ['X-CSRF-Token' => str_repeat('0', 64)],
            'uppercase' => ['X-CSRF-Token' => strtoupper($csrf)],
            'salinan sesi lain milik akun yang sama' => ['X-CSRF-Token' => $foreignCsrf],
        ];
        foreach ($invalidCsrfHeaders as $description => $csrfHeaders) {
            $denied = request($baseUrl, $mutationPath, 'POST', $forgedBody, 'application/json', $allowedCookie, $csrfHeaders);
            expectError($denied, 403, 'POST CSRF ' . $description . ' berhenti sebelum handler: ' . $label);
            expect(responseCsrfToken($denied) === $csrf, 'CSRF invalid tidak merotasi token sesi yang sah: ' . $label);
        }
        foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
            if ($method !== 'POST') {
                expectError(request($baseUrl, $path, $method, '{}', 'application/json', $allowedCookie), 403, $method . ' tanpa CSRF ditolak: ' . $label);
            }
            $allowed = request($baseUrl, $mutationPath, $method, $forgedBody, 'application/json', $allowedCookie, ['X-CSRF-Token' => $csrf]);
            if ($allowedStatus === 200) {
                expect($allowed['status'] === 200 && $allowed['body'] === ['user' => $identity], $method . ' CSRF valid mencapai fixture dengan identitas asli: ' . $label);
            } else {
                expectError($allowed, 501, $method . ' CSRF valid mencapai stub asli, bukan CRUD 200: ' . $label);
            }
            expect(responseCsrfToken($allowed) === $csrf, 'Sesi guard tetap aktif untuk validasi token mutasi: ' . $label);
        }
        $meAfterCsrf = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $allowedCookie);
        expect($meAfterCsrf['status'] === 200 && $meAfterCsrf['body'] === ['user' => $identity] && responseCsrfToken($meAfterCsrf) === $csrf, 'Penolakan CSRF tidak mengakhiri atau mengganti identitas: ' . $label);
    }
    $guardUsers->execute([$user['id'], $adminId]);
    expect($guardUsers->fetchAll() === $usersBeforeGuards, 'Semua request guard/stub tidak mengubah identitas, role, atau hash password kedua akun uji.');
    $guardTokens->execute([$user['id'], $adminId]);
    expect($guardTokens->fetchAll() === $tokensBeforeGuards, 'Request guard/stub termasuk CSRF invalid tidak mencabut atau mengubah hash remember.');

    // ---- Pengujian API Profil (/api/profile.php) ----
    // 1. GET profil member
    $profileRes = request($baseUrl, '/api/profile.php', 'GET', null, 'application/json', $loginCookie);
    expect($profileRes['status'] === 200, 'GET /api/profile.php mengembalikan status 200.');
    expect(isset($profileRes['body']['user']) && is_array($profileRes['body']['user']), 'GET profil memiliki objek user.');
    $profileData = $profileRes['body']['user'];
    expect($profileData['id'] === $user['id'], 'ID profil sesuai akun sesi.');
    expect($profileData['name'] === $user['name'], 'Nama profil sesuai akun sesi.');
    expect($profileData['email'] === $user['email'], 'Email profil sesuai akun sesi.');
    expect($profileData['role'] === 'member', 'Role profil sesuai akun sesi.');
    expect(is_string($profileData['created_at']) && strlen($profileData['created_at']) > 0, 'Waktu created_at berupa string valid.');
    expect(!array_key_exists('password_hash', $profileData), 'GET profil tidak mengekspos hash kata sandi.');
    expect(responseCsrfToken($profileRes) === $loginCsrf, 'GET profil menerbitkan token CSRF yang stabil.');

    // 2. GET profil admin
    $adminProfileRes = request($baseUrl, '/api/profile.php', 'GET', null, 'application/json', $adminCookie);
    expect($adminProfileRes['status'] === 200 && $adminProfileRes['body']['user']['role'] === 'admin', 'GET profil admin mengembalikan role admin.');

    // 3. Method tidak diizinkan
    $invalidMethodRes = request($baseUrl, '/api/profile.php', 'DELETE', null, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expectError($invalidMethodRes, 405, 'DELETE /api/profile.php ditolak.');
    expect(in_array('Allow: GET, POST, PUT, PATCH', $invalidMethodRes['headers'], true), 'Header Allow mencantumkan GET, POST, PUT, PATCH.');

    // 4. Validasi mutasi POST tanpa CSRF atau CSRF salah
    expectError(request($baseUrl, '/api/profile.php', 'POST', '{"name":"Baru"}', 'application/json', $loginCookie), 403, 'POST profil tanpa header CSRF ditolak.');
    expectError(request($baseUrl, '/api/profile.php', 'POST', '{"name":"Baru"}', 'application/json', $loginCookie, ['X-CSRF-Token' => 'salah']), 403, 'POST profil dengan CSRF salah ditolak.');

    // 5. Validasi tipe konten dan body
    expectError(request($baseUrl, '/api/profile.php', 'POST', 'name=Baru', 'application/x-www-form-urlencoded', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 415, 'Content-Type bukan JSON ditolak.');
    expectError(request($baseUrl, '/api/profile.php', 'POST', '{}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST profil tanpa field name ditolak.');
    expectError(request($baseUrl, '/api/profile.php', 'POST', '{"name": 123}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST profil dengan name bukan teks ditolak.');
    expectError(request($baseUrl, '/api/profile.php', 'POST', '{"name": "  ab  "}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST profil dengan name kurang dari 3 karakter ditolak.');
    expectError(request($baseUrl, '/api/profile.php', 'POST', json_encode(['name' => str_repeat('a', 101)]), 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST profil dengan name melebihi 100 karakter ditolak.');

    // 6. Mutasi berhasil (POST)
    $newName = 'Nama Baru ' . bin2hex(random_bytes(4));
    $updateRes = request($baseUrl, '/api/profile.php', 'POST', json_encode(['name' => $newName]), 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($updateRes['status'] === 200, 'POST pembaruan profil berhasil dengan status 200.');
    expect($updateRes['body']['user']['name'] === $newName, 'Respons mengembalikan nama yang baru diperbarui.');
    expect($updateRes['body']['user']['email'] === $user['email'], 'Email pengguna tidak berubah.');
    expect($updateRes['body']['user']['role'] === 'member', 'Role pengguna tidak berubah.');
    $stmt = $testPdo->prepare('SELECT name FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    expect($stmt->fetchColumn() === $newName, 'Nama pengguna di database benar-benar terupdate.');

    // 7. Percobaan pemalsuan field terlindungi (role, id, email) diabaikan
    $tamperedPayload = json_encode(['name' => 'Nama Tetap Sah', 'role' => 'admin', 'id' => 9999, 'email' => 'hacker@evil.com']);
    $tamperRes = request($baseUrl, '/api/profile.php', 'POST', $tamperedPayload, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($tamperRes['status'] === 200, 'Request dengan field tambahan terlindungi tetap diproses dengan aman.');
    expect($tamperRes['body']['user']['name'] === 'Nama Tetap Sah', 'Nama diperbarui.');
    expect($tamperRes['body']['user']['role'] === 'member', 'Role tetap member, tidak berubah jadi admin.');
    expect($tamperRes['body']['user']['id'] === $user['id'], 'ID tetap milik akun sesi.');
    expect($tamperRes['body']['user']['email'] === $user['email'], 'Email tetap milik akun sesi.');

    // 8. Dukungan method PUT dan PATCH
    $putRes = request($baseUrl, '/api/profile.php', 'PUT', json_encode(['name' => 'Nama Via PUT']), 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($putRes['status'] === 200 && $putRes['body']['user']['name'] === 'Nama Via PUT', 'PUT /api/profile.php berhasil memperbarui nama.');
    $patchRes = request($baseUrl, '/api/profile.php', 'PATCH', json_encode(['name' => 'Nama Via PATCH']), 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($patchRes['status'] === 200 && $patchRes['body']['user']['name'] === 'Nama Via PATCH', 'PATCH /api/profile.php berhasil memperbarui nama.');

    // Kembalikan nama akun uji ke semula agar pengujian lanjutan tetap sinkron
    $restoreStmt = $testPdo->prepare('UPDATE users SET name = ? WHERE id = ?');
    $restoreStmt->execute([$user['name'], $user['id']]);
    echo '[OK] Endpoint /api/profile.php (GET, POST, PUT, PATCH) berhasil diuji secara komprehensif.', PHP_EOL;

    // ---- Pengujian API Favorit (/api/favorites.php) ----
    // 1. GET favorit awal (kosong)
    $favRes = request($baseUrl, '/api/favorites.php', 'GET', null, 'application/json', $loginCookie);
    expect($favRes['status'] === 200, 'GET /api/favorites.php mengembalikan status 200.');
    expect(isset($favRes['body']['recipes']) && is_array($favRes['body']['recipes']), 'GET favorit mengembalikan array recipes.');
    expect($favRes['body']['recipes'] === [] && $favRes['body']['total'] === 0, 'Daftar favorit awal akun baru adalah kosong.');
    expect(responseCsrfToken($favRes) === $loginCsrf, 'GET favorit menerbitkan token CSRF yang stabil.');

    // 2. Method tidak diizinkan
    foreach (['PUT', 'PATCH'] as $badMethod) {
        $badMethodRes = request($baseUrl, '/api/favorites.php', $badMethod, '{}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
        expectError($badMethodRes, 405, $badMethod . ' /api/favorites.php ditolak.');
        expect(in_array('Allow: GET, POST, DELETE', $badMethodRes['headers'], true), 'Header Allow mencantumkan GET, POST, DELETE.');
    }

    // 3. Validasi mutasi POST favorit
    expectError(request($baseUrl, '/api/favorites.php', 'POST', '{"recipe_id":1}', 'application/json', $loginCookie), 403, 'POST favorit tanpa CSRF ditolak.');
    expectError(request($baseUrl, '/api/favorites.php', 'POST', '{"recipe_id":1}', 'application/json', $loginCookie, ['X-CSRF-Token' => 'salah']), 403, 'POST favorit dengan CSRF salah ditolak.');
    expectError(request($baseUrl, '/api/favorites.php', 'POST', 'recipe_id=1', 'application/x-www-form-urlencoded', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 415, 'POST favorit bukan JSON ditolak.');
    expectError(request($baseUrl, '/api/favorites.php', 'POST', '{}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST favorit tanpa recipe_id ditolak.');
    expectError(request($baseUrl, '/api/favorites.php', 'POST', '{"recipe_id":"abc"}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST favorit dengan recipe_id bukan angka ditolak.');
    expectError(request($baseUrl, '/api/favorites.php', 'POST', '{"recipe_id":-1}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST favorit dengan recipe_id negatif ditolak.');
    expectError(request($baseUrl, '/api/favorites.php', 'POST', '{"recipe_id":999999}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 404, 'POST favorit dengan resep tidak ada ditolak 404.');

    // 4. POST favorit berhasil
    $addFavRes = request($baseUrl, '/api/favorites.php', 'POST', '{"recipe_id":1}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($addFavRes['status'] === 200 && $addFavRes['body']['is_favorite'] === true, 'POST /api/favorites.php berhasil menyimpan resep ke favorit.');
    $stmt = $testPdo->prepare('SELECT 1 FROM favorites WHERE user_id = ? AND recipe_id = 1');
    $stmt->execute([$user['id']]);
    expect($stmt->fetchColumn() !== false, 'Relasi favorit tersimpan di database.');

    // Idempoten jika dikirim ulang
    $addAgainRes = request($baseUrl, '/api/favorites.php', 'POST', '{"recipe_id":1}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($addAgainRes['status'] === 200 && $addAgainRes['body']['is_favorite'] === true, 'POST favorit idempoten untuk resep yang sudah disimpan.');

    // 5. GET setelah ditambahkan
    $favListAfter = request($baseUrl, '/api/favorites.php', 'GET', null, 'application/json', $loginCookie);
    expect($favListAfter['status'] === 200 && count($favListAfter['body']['recipes']) === 1, 'GET favorit memuat 1 resep.');
    $firstFav = $favListAfter['body']['recipes'][0];
    expect($firstFav['id'] === 1 && $firstFav['title'] === 'Rendang Daging Sapi', 'Data resep favorit sesuai kartu resep.');
    expect(is_array($firstFav['categories']) && in_array('Makanan Berat', $firstFav['categories'], true), 'Kategori resep berupa array.');
    expect(is_string($firstFav['favorited_at']), 'Kolom favorited_at tersedia sebagai string.');

    // 6. Validasi DELETE favorit
    expectError(request($baseUrl, '/api/favorites.php?recipe_id=1', 'DELETE', null, 'application/json', $loginCookie), 403, 'DELETE favorit tanpa CSRF ditolak.');
    expectError(request($baseUrl, '/api/favorites.php', 'DELETE', null, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'DELETE favorit tanpa query recipe_id ditolak.');
    expectError(request($baseUrl, '/api/favorites.php?recipe_id=abc', 'DELETE', null, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'DELETE favorit dengan recipe_id invalid ditolak.');

    // 7. DELETE favorit berhasil
    $delFavRes = request($baseUrl, '/api/favorites.php?recipe_id=1', 'DELETE', null, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($delFavRes['status'] === 200 && $delFavRes['body']['is_favorite'] === false, 'DELETE favorit berhasil menghapus resep.');
    $stmt->execute([$user['id']]);
    expect($stmt->fetchColumn() === false, 'Relasi favorit di database benar-benar terhapus.');

    // 8. GET setelah dihapus kembali kosong
    $favListEmpty = request($baseUrl, '/api/favorites.php', 'GET', null, 'application/json', $loginCookie);
    expect($favListEmpty['body']['recipes'] === [] && $favListEmpty['body']['total'] === 0, 'Daftar favorit kembali kosong setelah dihapus.');
    echo '[OK] Endpoint /api/favorites.php (GET, POST, DELETE) berhasil diuji secara komprehensif.', PHP_EOL;

    // ---- Pengujian API Ulasan (/api/reviews.php) ----
    // 1. GET ulasan awal (kosong)
    $rvRes = request($baseUrl, '/api/reviews.php', 'GET', null, 'application/json', $loginCookie);
    expect($rvRes['status'] === 200, 'GET /api/reviews.php mengembalikan status 200.');
    expect(isset($rvRes['body']['reviews']) && is_array($rvRes['body']['reviews']), 'GET ulasan mengembalikan array reviews.');
    expect($rvRes['body']['reviews'] === [], 'Ulasan pengguna awal masih kosong.');
    expect(responseCsrfToken($rvRes) === $loginCsrf, 'GET ulasan menerbitkan token CSRF yang stabil.');

    // 2. Method tidak diizinkan
    foreach (['PUT', 'PATCH'] as $badMethod) {
        $badMethodRes = request($baseUrl, '/api/reviews.php', $badMethod, '{}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
        expectError($badMethodRes, 405, $badMethod . ' /api/reviews.php ditolak.');
        expect(in_array('Allow: GET, POST, DELETE', $badMethodRes['headers'], true), 'Header Allow mencantumkan GET, POST, DELETE.');
    }

    // 3. Validasi mutasi POST ulasan
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":1,"rating":5}', 'application/json', $loginCookie), 403, 'POST ulasan tanpa CSRF ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":1,"rating":5}', 'application/json', $loginCookie, ['X-CSRF-Token' => 'salah']), 403, 'POST ulasan dengan CSRF salah ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', 'recipe_id=1&rating=5', 'application/x-www-form-urlencoded', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 415, 'POST ulasan bukan JSON ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST ulasan tanpa recipe_id ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":"abc","rating":5}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST ulasan dengan recipe_id invalid ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":999999,"rating":5}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 404, 'POST ulasan untuk resep fiktif ditolak 404.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":1}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST ulasan tanpa rating ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":1,"rating":0}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST ulasan dengan rating 0 ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":1,"rating":6}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST ulasan dengan rating 6 ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', '{"recipe_id":1,"rating":5,"comment":123}', 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST ulasan dengan komentar bukan teks ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'POST', json_encode(['recipe_id' => 1, 'rating' => 5, 'comment' => str_repeat('a', 1001)]), 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'POST ulasan dengan komentar > 1000 karakter ditolak.');

    // 4. POST ulasan berhasil
    $postRvRes = request($baseUrl, '/api/reviews.php', 'POST', json_encode(['recipe_id' => 1, 'rating' => 5, 'comment' => 'Sangat lezat!']), 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($postRvRes['status'] === 200, 'POST /api/reviews.php berhasil dengan status 200.');
    expect($postRvRes['body']['review']['rating'] === 5 && $postRvRes['body']['review']['comment'] === 'Sangat lezat!', 'Data ulasan tersimpan sesuai request.');
    $stmt = $testPdo->prepare('SELECT rating, comment FROM reviews WHERE user_id = ? AND recipe_id = 1');
    $stmt->execute([$user['id']]);
    $savedRv = $stmt->fetch();
    expect((int) $savedRv['rating'] === 5 && $savedRv['comment'] === 'Sangat lezat!', 'Ulasan benar-benar tersimpan di database.');

    // 5. Update ulasan oleh user yang sama (ON DUPLICATE KEY UPDATE)
    $updateRvRes = request($baseUrl, '/api/reviews.php', 'POST', json_encode(['recipe_id' => 1, 'rating' => 4, 'comment' => 'Update: Bumbu pas']), 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($updateRvRes['status'] === 200 && $updateRvRes['body']['review']['rating'] === 4 && $updateRvRes['body']['review']['comment'] === 'Update: Bumbu pas', 'Ulasan berhasil diperbarui.');
    $stmt = $testPdo->prepare('SELECT COUNT(*) FROM reviews WHERE user_id = ? AND recipe_id = 1');
    $stmt->execute([$user['id']]);
    expect((int) $stmt->fetchColumn() === 1, 'Hanya ada 1 ulasan per user per resep, tidak ada baris duplikat.');

    // 6. GET ulasan per resep dan per user
    $rvByRecipe = request($baseUrl, '/api/reviews.php?recipe_id=1', 'GET', null, 'application/json', $loginCookie);
    expect($rvByRecipe['status'] === 200 && count($rvByRecipe['body']['reviews']) >= 1, 'GET ulasan per resep mengembalikan daftar ulasan.');
    $rvByUser = request($baseUrl, '/api/reviews.php', 'GET', null, 'application/json', $loginCookie);
    expect($rvByUser['status'] === 200 && count($rvByUser['body']['reviews']) === 1, 'GET ulasan user mengembalikan 1 ulasan milik pengguna.');

    // 7. DELETE ulasan
    expectError(request($baseUrl, '/api/reviews.php?recipe_id=1', 'DELETE', null, 'application/json', $loginCookie), 403, 'DELETE ulasan tanpa CSRF ditolak.');
    expectError(request($baseUrl, '/api/reviews.php', 'DELETE', null, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]), 422, 'DELETE ulasan tanpa query recipe_id ditolak.');
    $delRvRes = request($baseUrl, '/api/reviews.php?recipe_id=1', 'DELETE', null, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($delRvRes['status'] === 200, 'DELETE /api/reviews.php berhasil.');
    $stmt->execute([$user['id']]);
    expect((int) $stmt->fetchColumn() === 0, 'Ulasan di database terhapus.');
    echo '[OK] Endpoint /api/reviews.php (GET, POST, DELETE) berhasil diuji secara komprehensif.', PHP_EOL;

    // ---- Pengujian API Kelola Resep Admin (/api/admin/recipes.php) ----
    // 1. GET daftar semua resep untuk admin
    $adminListRes = request($baseUrl, '/api/admin/recipes.php', 'GET', null, 'application/json', $adminCookie);
    expect($adminListRes['status'] === 200, 'GET /api/admin/recipes.php mengembalikan status 200.');
    expect(isset($adminListRes['body']['recipes']) && is_array($adminListRes['body']['recipes']), 'GET admin/recipes mengembalikan array recipes.');
    expect($adminListRes['body']['total'] >= 14, 'Daftar resep admin memuat seluruh resep.');
    expect(responseCsrfToken($adminListRes) === $adminCsrf, 'GET admin/recipes menerbitkan token CSRF yang stabil.');

    // 2. Akses ditolak untuk member biasa
    $memberDenied = request($baseUrl, '/api/admin/recipes.php', 'GET', null, 'application/json', $loginCookie);
    expectError($memberDenied, 403, 'Member biasa ditolak 403 saat mengakses /api/admin/recipes.php.');

    // 3. Validasi POST tambah resep
    expectError(request($baseUrl, '/api/admin/recipes.php', 'POST', '{}', 'application/json', $adminCookie), 403, 'POST admin tanpa CSRF ditolak.');
    expectError(request($baseUrl, '/api/admin/recipes.php', 'POST', '{}', 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]), 422, 'POST tanpa title ditolak.');
    expectError(request($baseUrl, '/api/admin/recipes.php', 'POST', json_encode(['title' => 'ab', 'story' => 'cerita']), 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]), 422, 'POST title < 3 karakter ditolak.');
    expectError(request($baseUrl, '/api/admin/recipes.php', 'POST', json_encode(['title' => 'Resep Baru', 'story' => '']), 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]), 422, 'POST story kosong ditolak.');
    expectError(request($baseUrl, '/api/admin/recipes.php', 'POST', json_encode(['title' => 'Resep Baru', 'story' => 'cerita', 'cook_time_minutes' => 0]), 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]), 422, 'POST waktu 0 menit ditolak.');
    expectError(request($baseUrl, '/api/admin/recipes.php', 'POST', json_encode(['title' => 'Resep Baru', 'story' => 'cerita', 'difficulty' => 'salah']), 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]), 422, 'POST difficulty tidak valid ditolak.');

    // 4. POST tambah resep berhasil (lengkap dengan kategori, bahan, dan langkah)
    $newRecipePayload = [
        'title' => 'Ayam Taliwang Lombok Uji',
        'region' => 'Nusa Tenggara Barat',
        'story' => 'Ayam bakar dengan bumbu cabai dan terasi aromatik khas Lombok.',
        'categories' => ['Makanan Berat'],
        'cook_time_minutes' => 45,
        'difficulty' => 'sedang',
        'servings' => 4,
        'image_path' => 'img/ayam-betutu.jpg',
        'is_published' => true,
        'ingredients' => [
            ['name' => 'Ayam kampung', 'quantity' => 1, 'unit' => 'ekor'],
            ['name' => 'Cabai rawit', 'quantity' => 10, 'unit' => 'buah'],
        ],
        'steps' => [
            'Belah ayam kampung membujur lalu pipihkan.',
            'Bakar ayam hingga harum lalu lumuri dengan bumbu halus.',
        ],
    ];
    $createRecipeRes = request($baseUrl, '/api/admin/recipes.php', 'POST', json_encode($newRecipePayload), 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]);
    expect($createRecipeRes['status'] === 201, 'POST /api/admin/recipes.php mengembalikan status 201.');
    $createdRecipeId = (int) $createRecipeRes['body']['recipe']['id'];
    expect($createdRecipeId > 0, 'Resep baru memperoleh ID valid.');

    // 5. GET detail resep oleh admin
    $adminDetailRes = request($baseUrl, '/api/admin/recipes.php?id=' . $createdRecipeId, 'GET', null, 'application/json', $adminCookie);
    expect($adminDetailRes['status'] === 200, 'GET detail resep admin berhasil 200.');
    $detailData = $adminDetailRes['body']['recipe'];
    expect($detailData['title'] === 'Ayam Taliwang Lombok Uji', 'Judul resep detail sesuai input.');
    expect($detailData['categories'] === ['Makanan Berat'], 'Kategori resep tersimpan.');
    expect(count($detailData['ingredients']) === 2 && $detailData['ingredients'][0]['name'] === 'Ayam kampung', 'Bahan resep tersimpan.');
    expect(count($detailData['steps']) === 2 && $detailData['steps'][0] === 'Belah ayam kampung membujur lalu pipihkan.', 'Langkah resep tersimpan.');

    // 6. PUT pembaruan resep
    $updatedPayload = array_merge($newRecipePayload, [
        'title' => 'Ayam Taliwang Lombok Super Pedas',
        'story' => 'Versi super pedas dengan tambahan cabai rawit merah.',
        'cook_time_minutes' => 50,
    ]);
    $putRecipeRes = request($baseUrl, '/api/admin/recipes.php?id=' . $createdRecipeId, 'PUT', json_encode($updatedPayload), 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]);
    expect($putRecipeRes['status'] === 200, 'PUT /api/admin/recipes.php berhasil 200.');
    $stmt = $testPdo->prepare('SELECT title, cook_time_minutes FROM recipes WHERE id = ?');
    $stmt->execute([$createdRecipeId]);
    $updatedRow = $stmt->fetch();
    expect($updatedRow['title'] === 'Ayam Taliwang Lombok Super Pedas' && (int) $updatedRow['cook_time_minutes'] === 50, 'Data resep di MySQL terupdate.');

    // 7. PATCH moderasi resep (Sembunyikan dan Tayangkan)
    $patchHideRes = request($baseUrl, '/api/admin/recipes.php?id=' . $createdRecipeId, 'PATCH', '{"is_published":false}', 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]);
    expect($patchHideRes['status'] === 200 && $patchHideRes['body']['is_published'] === false, 'PATCH sembunyikan resep berhasil.');
    $stmt = $testPdo->prepare('SELECT is_published FROM recipes WHERE id = ?');
    $stmt->execute([$createdRecipeId]);
    expect((int) $stmt->fetchColumn() === 0, 'Status is_published menjadi 0 di database.');

    // Resep disembunyikan tidak muncul di endpoint publik
    $pubCheck = request($baseUrl, '/recipes?id=' . $createdRecipeId);
    expectError($pubCheck, 404, 'Resep disembunyikan admin tidak dapat diakses lewat endpoint publik.');

    // Tayangkan kembali
    $patchPubRes = request($baseUrl, '/api/admin/recipes.php?id=' . $createdRecipeId, 'PATCH', '{"is_published":true}', 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]);
    expect($patchPubRes['status'] === 200 && $patchPubRes['body']['is_published'] === true, 'PATCH tayangkan resep berhasil.');

    // 8. DELETE hapus resep oleh admin
    $deleteRecipeRes = request($baseUrl, '/api/admin/recipes.php?id=' . $createdRecipeId, 'DELETE', null, 'application/json', $adminCookie, ['X-CSRF-Token' => $adminCsrf]);
    expect($deleteRecipeRes['status'] === 200, 'DELETE /api/admin/recipes.php berhasil 200.');
    $stmt = $testPdo->prepare('SELECT id FROM recipes WHERE id = ?');
    $stmt->execute([$createdRecipeId]);
    expect($stmt->fetch() === false, 'Resep terhapus dari tabel recipes.');
    $stmt = $testPdo->prepare('SELECT id FROM recipe_ingredients WHERE recipe_id = ?');
    $stmt->execute([$createdRecipeId]);
    expect($stmt->fetch() === false, 'Bahan resep ikut terhapus otomatis melalui ON DELETE CASCADE.');
    echo '[OK] Endpoint /api/admin/recipes.php (CRUD & Moderasi) berhasil diuji secara komprehensif.', PHP_EOL;

    $switchLogin = request($baseUrl, '/auth?action=login', 'POST', json_encode($login, JSON_THROW_ON_ERROR));
    expect($switchLogin['status'] === 200 && $switchLogin['body'] === ['user' => $user], 'Login publik untuk uji pergantian akun tidak membutuhkan CSRF.');
    $switchOldCookie = sessionCookie($switchLogin);
    $switchOldCsrf = responseCsrfToken($switchLogin);
    $switchLogin = request($baseUrl, '/auth?action=login', 'POST', json_encode($adminLogin, JSON_THROW_ON_ERROR), 'application/json', $switchOldCookie);
    expect($switchLogin['status'] === 200 && $switchLogin['body'] === ['user' => $adminUser], 'Login publik dapat mengganti akun aktif tanpa header CSRF.');
    $switchCookie = sessionCookie($switchLogin);
    $switchCsrf = responseCsrfToken($switchLogin);
    expect($switchCookie !== $switchOldCookie && $switchCsrf !== $switchOldCsrf, 'Pergantian akun login meregenerasi ID sesi dan token CSRF.');
    expectError(request($baseUrl, '/protected/admin', 'POST', '{}', 'application/json', $switchCookie, ['X-CSRF-Token' => $switchOldCsrf]), 403, 'Token sebelum pergantian login tidak berlaku pada sesi baru.');
    $switched = request($baseUrl, '/protected/admin', 'POST', '{}', 'application/json', $switchCookie, ['X-CSRF-Token' => $switchCsrf]);
    expect($switched['status'] === 200 && $switched['body'] === ['user' => $adminUser], 'Token baru lolos setelah token lama ditolak tanpa mengakhiri login.');
    expectAnonymousGuard(request($baseUrl, '/protected/member', 'GET', null, 'application/json', $switchOldCookie), 'Cookie sebelum pergantian login tidak dapat melewati guard.');

    $me = request($baseUrl, '/auth?action=me&user_id=1&role=admin', 'GET', null, 'application/json', $loginCookie);
    expect($me['status'] === 200 && $me['body'] === ['user' => $user], 'Me memakai sesi server, bukan ID atau role dari query string.');
    expect(responseCsrfToken($me) === $loginCsrf, 'Me berulang tidak mengganti token sesi login.');
    $stmt = $testPdo->prepare('UPDATE users SET name = ? WHERE id = ?');
    $stmt->execute(['Nama Terbaru', $user['id']]);
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $loginCookie);
    expect($me['body'] === ['user' => array_replace($user, ['name' => 'Nama Terbaru'])], 'Me membaca ulang nama terbaru dari database tanpa mengubah field identitas lainnya.');
    $stmt->execute([$user['name'], $user['id']]);

    // Promosi/demosi hanya menyentuh akun uji kedua dan memakai cookie yang sudah ada.
    $roleUpdate = $testPdo->prepare('UPDATE users SET role = ? WHERE id = ?');
    foreach (['member', 'admin'] as $role) {
        $roleUpdate->execute([$role, $adminId]);
        $currentAdminUser = array_replace($adminUser, ['role' => $role]);
        foreach ([[$boundaryCookie, $boundaryCsrf], [$adminCookie, $adminCsrf]] as [$roleCookie, $roleCsrf]) {
            $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $roleCookie);
            expect($me['body'] === ['user' => $currentAdminUser] && responseCsrfToken($me) === $roleCsrf, 'Cookie lama langsung melihat role ' . $role . ' tanpa merotasi CSRF.');
            $memberAccess = request($baseUrl, '/protected/member', 'GET', null, 'application/json', $roleCookie);
            expect($memberAccess['status'] === 200 && $memberAccess['body'] === ['user' => $currentAdminUser], 'Guard member mengembalikan role terbaru ' . $role . '.');
            foreach ($adminPaths as $path) {
                foreach (['GET', 'POST'] as $method) {
                    $targetUrl = $path . '?role=admin' . ($path === '/api/admin/recipes.php' ? '' : '&id=' . $adminId);
                    $roleAccess = request($baseUrl, $targetUrl, $method, $method === 'POST' ? '{"role":"admin"}' : null, 'application/json', $roleCookie, $method === 'POST' ? ['X-CSRF-Token' => $roleCsrf] : []);
                    if ($role === 'member') {
                        expectError($roleAccess, 403, 'Demosi langsung mencabut izin admin meski query/body mengaku admin: ' . $method . ' ' . $path);
                    } elseif ($path === '/protected/admin') {
                        expect($roleAccess['status'] === 200 && $roleAccess['body'] === ['user' => $adminUser], 'Promosi langsung mengizinkan admin dengan cookie lama: ' . $method);
                    } elseif ($path === '/api/admin/recipes.php') {
                        if ($method === 'GET') {
                            expect($roleAccess['status'] === 200 && isset($roleAccess['body']['recipes']), 'Promosi langsung mengizinkan admin melihat resep: ' . $method);
                        } else {
                            expectError($roleAccess, 422, 'POST tanpa field resep ditolak 422 untuk admin sah: ' . $method);
                        }
                    } else {
                        expectError($roleAccess, 501, 'Promosi langsung mencapai stub admin asli: ' . $method . ' ' . $path);
                    }
                    expect(responseCsrfToken($roleAccess) === $roleCsrf, 'Perubahan role tidak mengubah token CSRF sesi.');
                }
            }
        }
    }
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', 'foodhub_session=' . bin2hex(random_bytes(16)));
    expect($me['body'] === ['user' => null], 'ID sesi palsu tidak menjadi identitas pengguna.');

    foreach ([[], ['X-CSRF-Token' => 'false'], ['X-CSRF-Token' => str_repeat('0', 64)], ['X-CSRF-Token' => $registrationCsrf], ['X-CSRF-Token' => $adminCsrf]] as $csrfHeaders) {
        $deniedLogout = request($baseUrl, '/auth?action=logout', 'POST', null, 'application/json', $loginCookie, $csrfHeaders);
        expectError($deniedLogout, 403, 'Logout authenticated tanpa CSRF yang cocok ditolak meski tidak ada body.');
        expect(responseCsrfToken($deniedLogout) === $loginCsrf, 'Logout ditolak tidak merotasi token.');
        $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $loginCookie);
        expect($me['body'] === ['user' => $user] && responseCsrfToken($me) === $loginCsrf, 'Logout CSRF invalid tidak mengakhiri atau mengganti login.');
    }
    $response = request($baseUrl, '/auth?action=logout', 'POST', null, 'application/json', $loginCookie, ['X-CSRF-Token' => $loginCsrf]);
    expect($response['status'] === 200 && $response['body'] === ['message' => 'Berhasil keluar.'], 'Logout berhasil tanpa membutuhkan body JSON.');
    expect(stripos(implode("\n", $response['headers']), 'Max-Age=0') !== false, 'Logout menghapus cookie sesi.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $loginCookie);
    expect($me['body'] === ['user' => null], 'Cookie sesi sebelum logout tidak dapat dipakai kembali.');
    $response = request($baseUrl, '/auth?action=logout', 'POST');
    expect($response['status'] === 200 && $response['body'] === ['message' => 'Berhasil keluar.'], 'Logout anonim tanpa CSRF atau body aman dan idempoten.');
    $response = request($baseUrl, '/auth?action=logout', 'POST', null, 'application/json', $loginCookie);
    expect($response['status'] === 200 && $response['body'] === ['message' => 'Berhasil keluar.'], 'Logout berulang dengan cookie yang sudah dicabut tetap idempoten.');

    $rememberLogin = array_replace($login, ['remember' => true]);
    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($rememberLogin, JSON_THROW_ON_ERROR));
    $rememberCookie = responseCookie($response, 'foodhub_remember');
    $originalRememberSessionCookie = sessionCookie($response);
    $rememberCsrf = responseCsrfToken($response);
    $selector = rememberSelector($rememberCookie);
    $rememberSession = request($baseUrl, '/session', 'GET', null, 'application/json', $originalRememberSessionCookie);
    expect($rememberSession['body']['session'] === ['remember_selector' => $selector, 'user_id' => $user['id'], 'csrf_token' => $rememberCsrf], 'Sesi remember menyimpan tepat selector, ID pengguna, dan CSRF valid tanpa token mentah/hash.');
    $rawToken = explode(':', rawurldecode(explode('=', $rememberCookie, 2)[1]))[1];
    $stmt = $testPdo->prepare('SELECT user_id, token_hash, expires_at FROM remember_tokens WHERE selector = ?');
    $stmt->execute([$selector]);
    $storedToken = $stmt->fetch();
    expect($storedToken !== false && (int) $storedToken['user_id'] === $user['id'] && $storedToken['token_hash'] !== $rawToken && hash_equals($storedToken['token_hash'], hash('sha256', $rawToken)), 'Database hanya menyimpan hash token acak, bukan token mentah.');
    $secondsLeft = strtotime($storedToken['expires_at'] . ' UTC') - time();
    expect($secondsLeft > 2591900 && $secondsLeft <= 2592000, 'Token remember kedaluwarsa setelah 30 hari dalam UTC.');
    foreach (['/protected/member', '/auth?action=logout'] as $path) {
        foreach ([[], ['X-CSRF-Token' => 'false'], ['X-CSRF-Token' => $registrationCsrf]] as $csrfHeaders) {
            $denied = request($baseUrl, $path, 'POST', null, 'application/json', $originalRememberSessionCookie . '; ' . $rememberCookie, $csrfHeaders);
            expectError($denied, 403, 'CSRF invalid tidak boleh memutasi/logout sesi remember: ' . $path);
            expect(responseCsrfToken($denied) === $rememberCsrf, 'CSRF remember tetap stabil setelah penolakan.');
            $stmt->execute([$selector]);
            expect($stmt->fetch() === $storedToken, 'CSRF invalid tidak mencabut atau mengubah hash/expiry token remember.');
            $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $originalRememberSessionCookie . '; ' . $rememberCookie);
            expect($me['body'] === ['user' => $user] && responseCsrfToken($me) === $rememberCsrf, 'Identitas remember tetap aktif sesudah CSRF invalid.');
        }
    }

    $restored = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $rememberCookie);
    expect($restored['status'] === 200 && $restored['body'] === ['user' => $user], 'Remember memulihkan login tanpa cookie sesi PHP.');
    $restoredCsrf = responseCsrfToken($restored);
    expect($restoredCsrf !== $rememberCsrf, 'Pemulihan remember pada sesi baru membuat token CSRF baru.');
    $restoredState = request($baseUrl, '/session', 'GET', null, 'application/json', sessionCookie($restored));
    expect($restoredState['body']['session'] === ['user_id' => $user['id'], 'remember_selector' => $selector, 'csrf_token' => $restoredCsrf], 'Sesi hasil restore berisi tepat identitas, selector yang benar, dan CSRF valid.');
    $rotatedCookie = responseCookie($restored, 'foodhub_remember');
    expect($rotatedCookie !== $rememberCookie, 'Token remember dirotasi setelah dipakai untuk pemulihan.');
    // Dua tab memakai snapshot cookie yang sama; terapkan respons kalah setelah pemenang.
    $cookieJar = ['foodhub_remember' => $rememberCookie];
    applyResponseCookies($cookieJar, $restored);
    $winningCookies = $cookieJar;
    $replay = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $rememberCookie);
    expect($replay['body'] === ['user' => null], 'Token remember lama tidak dapat diputar ulang.');
    applyResponseCookies($cookieJar, $replay);
    expect($cookieJar === $winningCookies, 'Respons pemulihan yang kalah tidak menimpa sesi/token hasil pemulihan pemenang.');
    expectNoAuthHeaders($replay, 'Replay remember pada me tidak menerbitkan cookie atau CSRF anonim.');
    foreach ($protectedPaths as $path) {
        foreach (['GET', 'POST'] as $method) {
            $loser = request($baseUrl, $path, $method, $method === 'POST' ? '{}' : null, 'application/json', $rememberCookie, ['X-CSRF-Token' => $rememberCsrf]);
            expectAnonymousGuard($loser, 'Snapshot remember kalah ditolak meski membawa CSRF lama: ' . $method . ' ' . $path);
            applyResponseCookies($cookieJar, $loser);
            expect($cookieJar === $winningCookies, 'Respons guard kalah tidak merusak cookie jar pemenang: ' . $path);
        }
    }
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', implode('; ', $cookieJar));
    expect($me['body'] === ['user' => $user], 'Cookie jar bersama tetap login setelah respons balapan diterapkan.');
    expect(responseCsrfToken($me) === $restoredCsrf, 'Respons guard balapan tidak mengganti CSRF sesi pemenang.');
    expectError(request($baseUrl, '/protected/member', 'POST', '{}', 'application/json', implode('; ', $cookieJar), ['X-CSRF-Token' => $rememberCsrf]), 403, 'Cookie jar pemenang menolak CSRF dari sesi remember sebelum pemulihan.');
    $winnerMutation = request($baseUrl, '/protected/member', 'POST', '{}', 'application/json', implode('; ', $cookieJar), ['X-CSRF-Token' => $restoredCsrf]);
    expect($winnerMutation['status'] === 200 && $winnerMutation['body'] === ['user' => $user], 'CSRF pemenang tetap dapat dipakai untuk mutasi setelah respons balapan kalah.');
    $restored = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $rotatedCookie);
    expect($restored['body'] === ['user' => $user], 'Replay token lama tidak mencabut token pengganti yang valid.');
    $rotatedCookie = responseCookie($restored, 'foodhub_remember');
    $restoredSessionCookie = sessionCookie($restored);
    $logoutCsrf = responseCsrfToken($restored);
    $response = request($baseUrl, '/auth?action=logout', 'POST', null, 'application/json', $restoredSessionCookie . '; ' . $rotatedCookie, ['X-CSRF-Token' => $logoutCsrf]);
    expect($response['status'] === 200 && responseCookie($response, 'foodhub_remember') !== $rotatedCookie, 'Logout menghapus cookie remember dan sesi.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $restoredSessionCookie);
    expect($me['body'] === ['user' => null], 'Sesi hasil pemulihan ikut tidak berlaku setelah logout.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $rotatedCookie);
    expect($me['body'] === ['user' => null], 'Token remember yang disalin sebelum logout sudah dicabut di server.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $originalRememberSessionCookie);
    expect($me['body'] === ['user' => null], 'Sesi awal dari selector remember yang dicabut tidak tetap aktif.');
    foreach ([$rotatedCookie, $restoredSessionCookie, $originalRememberSessionCookie, implode('; ', $winningCookies)] as $revokedCookie) {
        foreach ($protectedPaths as $path) {
            $revoked = request($baseUrl, $path, 'POST', '{}', 'application/json', $revokedCookie, ['X-CSRF-Token' => $logoutCsrf]);
            expectAnonymousGuard($revoked, 'Sesi/remember yang dicabut tidak melewati guard meski memiliki CSRF lama: ' . $path);
            applyResponseCookies($cookieJar, $revoked);
            expect($cookieJar === $winningCookies, 'Respons remember dicabut tidak mengirim cookie penimpa jar: ' . $path);
        }
    }

    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($rememberLogin, JSON_THROW_ON_ERROR));
    $expiredCookie = responseCookie($response, 'foodhub_remember');
    $expiredSessionCookie = sessionCookie($response);
    $guardRestored = request($baseUrl, '/protected/member', 'GET', null, 'application/json', $expiredCookie);
    expect($guardRestored['status'] === 200 && $guardRestored['body'] === ['user' => $user], 'Guard member memulihkan remember valid tanpa melalui me atau cookie sesi.');
    responseCsrfToken($guardRestored);
    $expiredGuardSessionCookie = sessionCookie($guardRestored);
    $expiredCookie = responseCookie($guardRestored, 'foodhub_remember');
    $stmt = $testPdo->prepare('UPDATE remember_tokens SET expires_at = UTC_TIMESTAMP() - INTERVAL 1 DAY WHERE selector = ?');
    $stmt->execute([rememberSelector($expiredCookie)]);
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $expiredCookie);
    expect($me['body'] === ['user' => null], 'Token remember kedaluwarsa tidak memulihkan login.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $expiredSessionCookie);
    expect($me['body'] === ['user' => null], 'Sesi Ingat saya juga berakhir saat tokennya kedaluwarsa.');
    foreach ([$expiredGuardSessionCookie, $expiredCookie] as $expiredIdentity) {
        expectAnonymousGuard(request($baseUrl, '/protected/member', 'GET', null, 'application/json', $expiredIdentity), 'Guard menolak remember/sesi kedaluwarsa yang belum dikonsumsi me.');
    }
    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($rememberLogin, JSON_THROW_ON_ERROR));
    $validRememberCookie = responseCookie($response, 'foodhub_remember');
    $rememberSessionCookie = sessionCookie($response);
    $selector = rememberSelector($validRememberCookie);
    $fakeCookie = 'foodhub_remember=' . $selector . ':' . str_repeat('0', 64);
    foreach ($protectedPaths as $path) {
        expectAnonymousGuard(request($baseUrl, $path, 'POST', '{}', 'application/json', $fakeCookie, ['X-CSRF-Token' => $loginCsrf]), 'Verifier palsu tidak melewati guard atau menghapus cookie browser lain: ' . $path);
    }
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $fakeCookie);
    expect($me['body'] === ['user' => null], 'Selector yang benar dengan verifier palsu tetap ditolak.');
    foreach (['foodhub_remember=rusak', 'foodhub_remember=' . bin2hex(random_bytes(12)) . ':' . bin2hex(random_bytes(32))] as $fakeCookie) {
        foreach ($protectedPaths as $path) {
            expectAnonymousGuard(request($baseUrl, $path, 'GET', null, 'application/json', $fakeCookie), 'Remember rusak/tidak dikenal ditolak tanpa cookie atau token CSRF: ' . $path);
        }
        $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $fakeCookie);
        expect($me['body'] === ['user' => null], 'Cookie remember rusak atau tidak dikenal ditolak tanpa error internal.');
    }
    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($login, ['remember' => false]), JSON_THROW_ON_ERROR), 'application/json', $rememberSessionCookie . '; ' . $validRememberCookie);
    expect($response['status'] === 200, 'Login tanpa remember dapat menggantikan login persisten.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $validRememberCookie);
    expect($me['body'] === ['user' => null], 'Login tanpa remember mencabut token lama pada browser yang sama.');

    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($rememberLogin, JSON_THROW_ON_ERROR));
    $validRememberCookie = responseCookie($response, 'foodhub_remember');
    $rememberSessionCookie = sessionCookie($response);
    $logoutMe = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $rememberSessionCookie);
    expect($logoutMe['body'] === ['user' => $user], 'Me mengambil CSRF untuk sesi logout yang ditargetkan, bukan sesi lain.');
    $logoutCsrf = responseCsrfToken($logoutMe);
    $response = request($baseUrl, '/auth?action=logout', 'POST', null, 'application/json', $rememberSessionCookie, ['X-CSRF-Token' => $logoutCsrf]);
    expect($response['status'] === 200, 'Logout tetap berhasil jika browser tidak mengirim cookie remember.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $validRememberCookie);
    expect($me['body'] === ['user' => null], 'Selector di sesi memungkinkan logout mencabut token yang disalin.');

    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode(array_replace($adminLogin, ['remember' => true]), JSON_THROW_ON_ERROR));
    $deletedSessionCookie = sessionCookie($response);
    $deletedRememberCookie = responseCookie($response, 'foodhub_remember');
    $guardRestored = request($baseUrl, '/protected/admin', 'GET', null, 'application/json', $deletedRememberCookie);
    expect($guardRestored['status'] === 200 && $guardRestored['body'] === ['user' => $adminUser], 'Guard admin memulihkan remember valid dengan identitas/role database tanpa me.');
    responseCsrfToken($guardRestored);
    $deletedGuardSessionCookie = sessionCookie($guardRestored);
    $deletedRememberCookie = responseCookie($guardRestored, 'foodhub_remember');
    $stmt = $testPdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$adminId]);
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $deletedSessionCookie . '; ' . $deletedRememberCookie);
    expect($me['status'] === 200 && $me['body'] === ['user' => null], 'Akun yang dihapus tidak tetap login meskipun sesi masih ada.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $deletedRememberCookie);
    expect($me['body'] === ['user' => null], 'Token akun yang dihapus ikut dicabut lewat foreign key.');
    foreach ([$deletedGuardSessionCookie . '; ' . $deletedRememberCookie, $adminCookie, $deletedRememberCookie] as $deletedCookie) {
        foreach ($protectedPaths as $path) {
            expectAnonymousGuard(request($baseUrl, $path, 'GET', null, 'application/json', $deletedCookie), 'Akun dihapus langsung mendapat 401 di guard asli: ' . $path);
        }
    }

    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($rememberLogin, JSON_THROW_ON_ERROR));
    $previousAccountCookie = responseCookie($response, 'foodhub_remember');
    $previousSessionCookie = sessionCookie($response);
    $previousAccountCsrf = responseCsrfToken($response);
    $response = request($baseUrl, '/auth?action=register', 'POST', json_encode($boundary, JSON_THROW_ON_ERROR), 'application/json', $previousSessionCookie . '; ' . $previousAccountCookie);
    expect($response['status'] === 201, 'Registrasi akun baru dapat menggantikan sesi akun sebelumnya tanpa header CSRF.');
    $newAccountCookie = sessionCookie($response);
    $newAccountCsrf = responseCsrfToken($response);
    $newAccountUser = $response['body']['user'];
    expect(array_keys($newAccountUser) === ['id', 'name', 'email', 'role'] && $newAccountUser['id'] !== $user['id'] && $newAccountUser['name'] === $boundary['name'] && $newAccountUser['email'] === $testEmails[1] && $newAccountUser['role'] === 'member', 'Registrasi pengganti tetap mengembalikan identitas lengkap tanpa hash atau token di JSON.');
    expect($newAccountCookie !== $previousSessionCookie && $newAccountCsrf !== $previousAccountCsrf, 'Pergantian akun lewat registrasi merotasi ID sesi dan CSRF.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $newAccountCookie);
    expect($me['body'] === ['user' => $newAccountUser] && responseCsrfToken($me) === $newAccountCsrf, 'Me setelah registrasi menampilkan akun baru dengan CSRF stabil, bukan akun lama.');
    expectError(request($baseUrl, '/protected/member', 'POST', '{}', 'application/json', $newAccountCookie, ['X-CSRF-Token' => $previousAccountCsrf]), 403, 'Token akun sebelum registrasi ditolak pada sesi pengganti.');
    $newAccountAccess = request($baseUrl, '/protected/member', 'POST', '{}', 'application/json', $newAccountCookie, ['X-CSRF-Token' => $newAccountCsrf]);
    expect($newAccountAccess['status'] === 200 && $newAccountAccess['body'] === ['user' => $newAccountUser], 'CSRF baru setelah registrasi mencapai fixture dengan identitas baru.');
    expectAnonymousGuard(request($baseUrl, '/protected/member', 'GET', null, 'application/json', $previousSessionCookie), 'Cookie sesi sebelum registrasi pengganti ditolak guard.');
    $me = request($baseUrl, '/auth?action=me', 'GET', null, 'application/json', $previousAccountCookie);
    expect($me['body'] === ['user' => null], 'Registrasi mencabut token remember akun sebelumnya pada browser yang sama.');

    // ---- 10A: daftar resep publik, memakai fixture khusus yang dihapus pada blok finally ----
    $unique = 'uji' . bin2hex(random_bytes(6));
    $fixtures = [
        'a' => ['Alfa ' . $unique, 20, 'mudah', 1, '2030-01-02 08:00:00', ['Sehat', 'Cepat']],
        'b' => ['Beta ' . $unique, 90, 'sulit', 1, '2030-01-01 08:00:00', ['Sehat']],
        'c' => ['Gamma ' . $unique, 10, 'mudah', 0, '2030-01-05 08:00:00', ['Sehat']],
        'd' => ['Diskon 100% ' . $unique, 40, 'sedang', 1, '2030-01-03 08:00:00', []],
    ];
    $recipeIds = [];
    $insertRecipe = $testPdo->prepare('INSERT INTO recipes (title, slug, region, story, cook_time_minutes, difficulty, servings, is_published, created_at) VALUES (?, ?, ?, ?, ?, ?, 2, ?, ?)');
    $insertCategory = $testPdo->prepare('INSERT INTO recipe_categories (recipe_id, category_id) SELECT ?, id FROM categories WHERE name = ?');
    foreach ($fixtures as $key => [$title, $minutes, $level, $published, $createdAt, $categoryNames]) {
        $insertRecipe->execute([$title, $testPrefix . '-' . $key, 'Daerah Uji', 'Cerita ' . $title, $minutes, $level, $published, $createdAt]);
        $recipeIds[$key] = (int) $testPdo->lastInsertId();
        foreach ($categoryNames as $categoryName) {
            $insertCategory->execute([$recipeIds[$key], $categoryName]);
            expect($insertCategory->rowCount() === 1, 'Kategori fixture tersedia: ' . $categoryName);
        }
    }
    $insertIngredient = $testPdo->prepare('INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, 1, ?, ?)');
    $insertIngredient->execute([$recipeIds['b'], 'bahanrahasia' . $unique . ' satu', 'g', 1]);
    $insertIngredient->execute([$recipeIds['b'], 'bahanrahasia' . $unique . ' dua', 'g', 2]);
    $insertIngredient->execute([$recipeIds['c'], 'bahantersembunyi' . $unique, 'g', 1]);
    $memberIds = [];
    foreach ($testEmails as $email) {
        $stmt = $testPdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $memberIds[] = (int) $stmt->fetchColumn();
    }
    expect(!in_array(0, $memberIds, true), 'Dua akun uji tersedia untuk favorit dan ulasan fixture.');
    $insertFavorite = $testPdo->prepare('INSERT INTO favorites (user_id, recipe_id) VALUES (?, ?)');
    $insertFavorite->execute([$memberIds[0], $recipeIds['a']]);
    $insertFavorite->execute([$memberIds[1], $recipeIds['a']]);
    $insertFavorite->execute([$memberIds[0], $recipeIds['b']]);
    $insertReview = $testPdo->prepare('INSERT INTO reviews (recipe_id, user_id, rating, comment) VALUES (?, ?, ?, ?)');
    $insertReview->execute([$recipeIds['b'], $memberIds[0], 5, 'Mantap']);
    $insertReview->execute([$recipeIds['b'], $memberIds[1], 4, 'Enak']);

    $listRecipes = static fn (array $query): array => request($baseUrl, '/recipes?' . http_build_query($query));
    $listIds = static fn (array $response): array => array_column($response['body']['recipes'], 'id');
    $expectIds = static function (array $query, array $keys, string $message) use ($listRecipes, $listIds, $recipeIds): void {
        $response = $listRecipes($query);
        $expected = array_map(static fn (string $key): int => $recipeIds[$key], $keys);
        expect($response['status'] === 200 && $listIds($response) === $expected && $response['body']['total'] === count($expected), $message);
    };

    $response = $listRecipes(['q' => $unique]);
    expect($response['status'] === 200 && in_array('Content-Type: application/json; charset=utf-8', $response['headers'], true), 'Daftar resep mengembalikan JSON 200.');
    expectNoAuthHeaders($response, 'Daftar resep publik tidak membuat sesi atau token CSRF.');
    expect(array_keys($response['body']) === ['recipes', 'total', 'limit', 'offset'] && $response['body']['limit'] === 100 && $response['body']['offset'] === 0, 'Respons daftar memuat recipes, total, limit default 100, dan offset 0.');
    $expectIds(['q' => $unique], ['a', 'b', 'd'], 'Resep disembunyikan tidak tampil; urutan default popular mengikuti jumlah favorit (2, 1, 0).');
    $recipeA = $response['body']['recipes'][0];
    expect(array_keys($recipeA) === ['id', 'title', 'slug', 'region', 'story', 'image_path', 'cook_time_minutes', 'difficulty', 'servings', 'is_published', 'created_at', 'avg_rating', 'review_count', 'favorite_count', 'categories'], 'Setiap resep memuat field yang dibutuhkan kartu frontend.');
    expect($recipeA['title'] === $fixtures['a'][0] && $recipeA['story'] === 'Cerita ' . $fixtures['a'][0] && $recipeA['image_path'] === null && $recipeA['region'] === 'Daerah Uji', 'Judul, deskripsi, daerah, dan gambar kosong dikirim apa adanya.');
    expect($recipeA['cook_time_minutes'] === 20 && $recipeA['servings'] === 2 && $recipeA['is_published'] === true && $recipeA['difficulty'] === 'mudah', 'Angka dan status publikasi dikirim sebagai integer/boolean JSON.');
    expect($recipeA['avg_rating'] === null && $recipeA['review_count'] === 0 && $recipeA['favorite_count'] === 2, 'Resep tanpa ulasan memiliki rating null dan jumlah favorit benar.');
    expect($recipeA['categories'] === ['Cepat', 'Sehat'], 'Kategori dikirim sebagai array nama terurut, bukan string gabungan.');
    $recipeB = $response['body']['recipes'][1];
    expect($recipeB['avg_rating'] === 4.5 && $recipeB['review_count'] === 2 && $recipeB['favorite_count'] === 1, 'Rating rata-rata, jumlah ulasan, dan favorit dihitung dari database.');
    expect($response['body']['recipes'][2]['categories'] === [], 'Resep tanpa kategori memiliki array kategori kosong.');
    $response = $listRecipes([]);
    expect($response['status'] === 200 && $response['body']['total'] >= 3 && !in_array($recipeIds['c'], $listIds($response), true), 'Daftar tanpa filter hanya memuat resep tayang.');

    $expectIds(['q' => $unique, 'sort' => 'title'], ['a', 'b', 'd'], 'Sort title mengurutkan abjad.');
    $expectIds(['q' => $unique, 'sort' => 'time'], ['a', 'd', 'b'], 'Sort time mengurutkan waktu memasak tercepat.');
    $expectIds(['q' => $unique, 'sort' => 'newest'], ['d', 'a', 'b'], 'Sort newest mengurutkan resep terbaru.');
    $expectIds(['q' => $unique, 'sort' => 'rating'], ['b', 'a', 'd'], 'Sort rating mengutamakan rating tertinggi dan menaruh tanpa rating terakhir.');
    $expectIds(['q' => $unique, 'sort' => 'popular'], ['a', 'b', 'd'], 'Sort popular eksplisit sama dengan default.');

    $expectIds(['q' => strtoupper($unique)], ['a', 'b', 'd'], 'Pencarian judul tidak membedakan huruf besar/kecil.');
    $expectIds(['q' => '  Alfa ' . $unique . '  '], ['a'], 'Pencarian dipotong spasi dan mencocokkan sebagian judul.');
    $expectIds(['q' => 'bahanrahasia' . $unique], ['b'], 'Pencarian bahan menemukan resep tanpa duplikat meski dua bahan cocok.');
    $expectIds(['q' => 'bahantersembunyi' . $unique], [], 'Bahan milik resep disembunyikan tidak membocorkan resep.');
    $expectIds(['q' => 'Gamma ' . $unique], [], 'Judul resep disembunyikan tidak dapat ditemukan.');
    $expectIds(['q' => '100% ' . $unique], ['d'], 'Karakter % dicari sebagai teks biasa.');
    $expectIds(['q' => '%' . $unique], [], 'Wildcard % tidak mencocokkan semua judul.');
    $expectIds(['q' => 'Alfa_' . $unique], [], 'Wildcard _ tidak mencocokkan spasi.');
    $expectIds(['q' => "' OR 1=1 -- "], [], 'Input mirip SQL injection diperlakukan sebagai teks pencarian.');
    $response = $listRecipes(['q' => '   ']);
    expect($response['status'] === 200 && $response['body']['total'] >= 3, 'Query q berisi spasi saja dianggap tidak ada filter.');

    $expectIds(['q' => $unique, 'category' => 'Sehat', 'sort' => 'title'], ['a', 'b'], 'Filter kategori memakai nama kategori.');
    $expectIds(['q' => $unique, 'category' => 'sehat', 'sort' => 'title'], ['a', 'b'], 'Filter kategori juga menerima slug/huruf kecil.');
    $expectIds(['q' => $unique, 'category' => 'Cepat'], ['a'], 'Filter kategori memilih resep dengan banyak kategori.');
    $response = $listRecipes(['q' => $unique, 'category' => 'Sehat', 'sort' => 'title']);
    expect($response['body']['recipes'][0]['categories'] === ['Cepat', 'Sehat'], 'Filter kategori tidak menghilangkan kategori lain pada hasil.');
    $expectIds(['q' => $unique, 'category' => 'Kategori Tidak Ada'], [], 'Kategori tidak dikenal menghasilkan daftar kosong, bukan error.');
    $expectIds(['q' => $unique, 'difficulty' => 'mudah'], ['a'], 'Filter difficulty mudah hanya memuat resep tayang.');
    $expectIds(['q' => $unique, 'difficulty' => 'SULIT'], ['b'], 'Filter difficulty tidak membedakan huruf besar/kecil.');
    $expectIds(['q' => $unique, 'max_time' => 20, 'sort' => 'time'], ['a'], 'Filter max_time termasuk batas atas.');
    $expectIds(['q' => $unique, 'min_time' => 40, 'sort' => 'time'], ['d', 'b'], 'Filter min_time termasuk batas bawah (dipakai opsi lebih dari 60 menit).');
    $expectIds(['q' => $unique, 'min_time' => 40, 'max_time' => 40], ['d'], 'Rentang waktu satu nilai tetap valid.');
    $expectIds(['q' => $unique, 'category' => 'Sehat', 'difficulty' => 'mudah', 'max_time' => 30], ['a'], 'Semua filter digabung dengan AND.');
    $expectIds(['q' => $unique, 'category' => '', 'difficulty' => ' ', 'sort' => 'title'], ['a', 'b', 'd'], 'Filter kosong diabaikan.');

    $response = $listRecipes(['q' => $unique, 'sort' => 'title', 'limit' => 2]);
    expect($response['status'] === 200 && $listIds($response) === [$recipeIds['a'], $recipeIds['b']], 'Limit membatasi jumlah resep yang dikirim.');
    expect($response['body']['total'] === 3 && $response['body']['limit'] === 2 && $response['body']['offset'] === 0, 'Total tetap jumlah seluruh hasil meski dibatasi limit.');
    $response = $listRecipes(['q' => $unique, 'sort' => 'title', 'limit' => 2, 'offset' => 2]);
    expect($listIds($response) === [$recipeIds['d']] && $response['body']['total'] === 3 && $response['body']['offset'] === 2, 'Offset melanjutkan halaman berikutnya.');
    $response = $listRecipes(['q' => $unique, 'offset' => 3]);
    expect($response['status'] === 200 && $response['body']['recipes'] === [] && $response['body']['total'] === 3, 'Offset melewati data menghasilkan array kosong.');
    $response = $listRecipes(['q' => $unique, 'limit' => 100]);
    expect($response['status'] === 200 && $response['body']['limit'] === 100, 'Limit maksimum 100 diterima.');

    foreach ([
        ['limit' => 0], ['limit' => 101], ['limit' => 'abc'], ['limit' => '1.5'], ['limit' => '-1'], ['limit' => '99999999999'],
        ['offset' => -1], ['offset' => 'x'], ['offset' => 100001],
        ['max_time' => 0], ['max_time' => 'abc'], ['max_time' => 65536], ['min_time' => '-5'],
        ['min_time' => 50, 'max_time' => 40],
        ['difficulty' => 'ekstrem'], ['sort' => 'id; DROP TABLE recipes'], ['sort' => 'created_at'],
        ['q' => str_repeat('a', 101)], ['category' => str_repeat('b', 51)],
        ['q' => ['a']], ['category' => ['Sehat']], ['sort' => ['title']], ['limit' => ['2']],
    ] as $invalidQuery) {
        expectError($listRecipes($invalidQuery), 422, 'Query tidak valid ditolak 422: ' . http_build_query($invalidQuery));
    }
    expectError(request($baseUrl, '/recipes?q=%FF'), 422, 'Teks query bukan UTF-8 ditolak.');
    $response = request($baseUrl, '/recipes?q=' . str_repeat('a', 100));
    expect($response['status'] === 200, 'Query q tepat 100 karakter diterima.');
    $response = request($baseUrl, '/recipes?q=' . rawurlencode(str_repeat('界', 100)));
    expect($response['status'] === 200, 'Batas panjang q dihitung per karakter Unicode, bukan byte.');
    $response = request($baseUrl, '/recipes?unknown=1&q=' . rawurlencode($unique) . '&sort=title');
    expect($response['status'] === 200 && $listIds($response) === [$recipeIds['a'], $recipeIds['b'], $recipeIds['d']], 'Parameter tidak dikenal diabaikan.');

    foreach (['POST', 'PUT', 'PATCH', 'DELETE'] as $method) {
        $response = request($baseUrl, '/recipes', $method, '{}');
        expectError($response, 405, 'Daftar resep menolak method ' . $method . '.');
        expect(in_array('Allow: GET', $response['headers'], true), 'Daftar resep mengirim Allow: GET untuk ' . $method . '.');
    }
    // ---- 10B: detail resep publik dan status favorit berdasarkan sesi asli ----
    $stmt = $testPdo->prepare('UPDATE recipes SET created_by = ? WHERE id = ?');
    $stmt->execute([$memberIds[0], $recipeIds['b']]);
    $stmt = $testPdo->prepare('SELECT name FROM users WHERE id = ?');
    $stmt->execute([$memberIds[0]]);
    $authorName = $stmt->fetchColumn();
    $stmt = $testPdo->prepare('UPDATE recipe_ingredients SET quantity = NULL, unit = NULL WHERE recipe_id = ? AND sort_order = 2');
    $stmt->execute([$recipeIds['b']]);
    $stmt = $testPdo->prepare('INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit, sort_order) VALUES (?, ?, 1.25, ?, 0)');
    $stmt->execute([$recipeIds['b'], 'Bahan pecahan ✓', 'sdm']);
    $stmt = $testPdo->prepare('INSERT INTO recipe_steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)');
    $stmt->execute([$recipeIds['b'], 2, 'Masak hingga matang.']);
    $stmt->execute([$recipeIds['b'], 1, 'Siapkan bahan ✓.']);
    $stmt = $testPdo->prepare('UPDATE reviews SET created_at = ? WHERE recipe_id = ?');
    $stmt->execute(['2030-01-01 12:00:00', $recipeIds['b']]);

    $detail = static fn (int $id, string $cookie = '', string $extraQuery = ''): array => request($baseUrl, '/recipes?id=' . $id . $extraQuery, 'GET', null, 'application/json', $cookie);
    $response = $detail($recipeIds['b']);
    expect($response['status'] === 200 && array_keys($response['body']) === ['recipe'], 'Detail publik memakai objek recipe tanpa wrapper data.');
    expectNoAuthHeaders($response, 'Detail anonim tanpa cookie tidak membuat sesi atau menerbitkan CSRF.');
    expect(in_array('Cache-Control: no-store', $response['headers'], true), 'Detail dengan status favorit tidak boleh di-cache.');
    $recipe = $response['body']['recipe'];
    foreach ($recipeB as $field => $value) {
        expect($recipe[$field] === $value, 'Field detail konsisten dengan daftar: ' . $field);
    }
    expect($recipe['author'] === $authorName && $recipe['is_favorite'] === false, 'Penulis berasal dari database dan anonim bukan pemilik favorit.');
    expect($recipe['ingredients'] === [
        ['name' => 'Bahan pecahan ✓', 'quantity' => 1.25, 'unit' => 'sdm'],
        ['name' => 'bahanrahasia' . $unique . ' satu', 'quantity' => 1, 'unit' => 'g'],
        ['name' => 'bahanrahasia' . $unique . ' dua', 'quantity' => null, 'unit' => null],
    ], 'Bahan diurutkan sort_order; takaran angka pecahan dan null dipertahankan untuk kalkulator porsi.');
    expect($recipe['steps'] === ['Siapkan bahan ✓.', 'Masak hingga matang.'], 'Langkah berupa array teks sesuai step_number, bukan urutan insert.');
    expect(count($recipe['reviews']) === 2 && array_column($recipe['reviews'], 'rating') === [4, 5] && array_column($recipe['reviews'], 'comment') === ['Enak', 'Mantap'], 'Ulasan diurutkan terbaru dengan ID sebagai tie-breaker.');
    expect(array_keys($recipe['reviews'][0]) === ['user_name', 'rating', 'comment', 'created_at'] && $recipe['reviews'][1]['user_name'] === $authorName && $recipe['reviews'][0]['created_at'] === '2030-01-01 12:00:00', 'Ulasan hanya mengekspos nama, rating integer, komentar, dan waktu; tanpa email/hash.');
    expect(array_keys($recipe) === array_merge(array_keys($recipeB), ['author', 'ingredients', 'steps', 'reviews', 'is_favorite']), 'Detail tidak membocorkan kolom akun atau token autentikasi.');
    $empty = $detail($recipeIds['d'])['body']['recipe'];
    expect($empty['categories'] === [] && $empty['ingredients'] === [] && $empty['steps'] === [] && $empty['reviews'] === [], 'Relasi kosong tetap dikirim sebagai array kosong.');
    expect($empty['author'] === 'Tim FoodHub' && $empty['avg_rating'] === null && $empty['is_favorite'] === false, 'Penulis kosong memakai Tim FoodHub dan resep tanpa ulasan memiliki rating null.');
    $forged = $detail($recipeIds['b'], '', '&user_id=' . $memberIds[0] . '&role=admin');
    expect($forged['body']['recipe']['is_favorite'] === false, 'ID pengguna/role di query tidak dapat memalsukan status favorit.');
    foreach (['foodhub_session=tidakvalid', 'foodhub_remember=rusak', $deletedSessionCookie] as $invalidCookie) {
        $response = $detail($recipeIds['b'], $invalidCookie);
        expect($response['status'] === 200 && $response['body']['recipe']['is_favorite'] === false, 'Cookie invalid atau akun terhapus tetap dapat membaca detail sebagai tamu.');
        expectNoAuthHeaders($response, 'Detail tamu dengan cookie invalid tidak menimpa cookie tab lain.');
    }

    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($login, JSON_THROW_ON_ERROR));
    $detailCookie = sessionCookie($response);
    $detailCsrf = responseCsrfToken($response);
    $response = $detail($recipeIds['b'], $detailCookie);
    expect($response['status'] === 200 && $response['body']['recipe']['is_favorite'] === true && responseCsrfToken($response) === $detailCsrf, 'Sesi member membaca favoritnya dan mempertahankan CSRF.');
    expect($detail($recipeIds['d'], $detailCookie)['body']['recipe']['is_favorite'] === false, 'Login tidak membuat semua resep otomatis menjadi favorit.');
    expect($detail($recipeIds['b'], $newAccountCookie)['body']['recipe']['is_favorite'] === false, 'Favorit pengguna lain tidak bocor ke pengguna yang sedang login.');
    expect($detail($recipeIds['a'], $newAccountCookie)['body']['recipe']['is_favorite'] === true, 'Pengguna kedua mendapat status favorit miliknya sendiri.');

    foreach (['', '%20', '0', '-1', '1.5', '1e2', 'abc', '4294967296', '99999999999', '%00', '%B1', '1%20OR%201=1'] as $invalidId) {
        $response = request($baseUrl, '/recipes?id=' . $invalidId);
        expectError($response, 422, 'ID detail tidak valid ditolak: ' . $invalidId);
        expectNoAuthHeaders($response, 'ID tidak valid tidak membuat sesi.');
    }
    expectError(request($baseUrl, '/recipes?id[]=1'), 422, 'ID detail berbentuk array ditolak.');
    expect($detail($recipeIds['b'], '', '&q=tidakcocok&sort=invalid')['body']['recipe']['id'] === $recipeIds['b'], 'Parameter daftar tidak mengubah lookup detail berdasarkan ID.');
    expectError($detail($recipeIds['c']), 404, 'Resep disembunyikan tidak tersedia lewat URL detail langsung.');
    $stmt = $testPdo->prepare('UPDATE users SET role = ? WHERE id = ?');
    $stmt->execute(['admin', $memberIds[0]]);
    expectError($detail($recipeIds['c'], $detailCookie), 404, 'Endpoint publik tidak mengekspos resep tersembunyi meskipun pembaca admin.');
    $stmt->execute(['member', $memberIds[0]]);
    $stmt = $testPdo->prepare('DELETE FROM recipes WHERE id = ?');
    $stmt->execute([$recipeIds['d']]);
    expectError($detail($recipeIds['d']), 404, 'Resep yang sudah dihapus menghasilkan 404.');
    foreach (['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as $method) {
        $response = request($baseUrl, '/recipes?id=' . $recipeIds['b'], $method, '{}');
        expect($response['status'] === 405 && ($method === 'HEAD' || isset($response['body']['error'])), 'Detail menolak method ' . $method . '.');
        expect(in_array('Allow: GET', $response['headers'], true), 'Detail mengirim Allow: GET.');
    }

    $response = request($baseUrl, '/auth?action=login', 'POST', json_encode($rememberLogin, JSON_THROW_ON_ERROR));
    $detailRememberCookie = responseCookie($response, 'foodhub_remember');
    $response = $detail($recipeIds['b'], $detailRememberCookie);
    expect($response['status'] === 200 && $response['body']['recipe']['is_favorite'] === true, 'Detail memulihkan remember valid tanpa wajib mengunjungi me lebih dahulu.');
    $restoredDetailCookie = sessionCookie($response);
    $restoredDetailCsrf = responseCsrfToken($response);
    expect(responseCookie($response, 'foodhub_remember') !== $detailRememberCookie, 'Pemulihan remember lewat detail merotasi verifier.');
    $replay = $detail($recipeIds['b'], $detailRememberCookie);
    expect($replay['status'] === 200 && $replay['body']['recipe']['is_favorite'] === false, 'Replay remember lama hanya mendapat detail anonim.');
    expectNoAuthHeaders($replay, 'Replay di detail tidak menimpa cookie pemulihan yang sah.');
    $response = request($baseUrl, '/auth?action=logout', 'POST', '{}', 'application/json', $restoredDetailCookie, ['X-CSRF-Token' => $restoredDetailCsrf]);
    expect($response['status'] === 200 && $detail($recipeIds['b'], $restoredDetailCookie)['body']['recipe']['is_favorite'] === false, 'Setelah logout detail kembali memakai status favorit anonim.');

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
            // Resep fixture menghapus bahan, kategori, favorit, dan ulasannya lewat ON DELETE CASCADE.
            $stmt = $testPdo->prepare('DELETE FROM recipes WHERE slug LIKE ?');
            $stmt->execute([$testPrefix . '-%']);
        } catch (Throwable $exception) {
            fwrite(STDERR, '[GAGAL] Pembersihan resep uji: ' . $exception->getMessage() . PHP_EOL);
            $exitCode = 1;
        }
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
