<?php
/**
 * Profil > Informasi Profil (wajib login)
 *   GET  /backend/api/profile.php                           -> data akun
 *   POST /backend/api/profile.php  {name, bio}              -> ubah nama & bio
 *   POST /backend/api/profile.php?action=password
 *        {current_password, new_password}                   -> ganti kata sandi
 */

declare(strict_types=1);

require_once __DIR__ . '/../includes/bootstrap.php';

allow('GET', 'POST');
$user   = require_login();
$userId = (int) $user['id'];

if (method() === 'GET') {
    json_out(['user' => user_out($user)]);
}

if (($_GET['action'] ?? '') === 'password') {
    $current = (string) (input()['current_password'] ?? '');
    $new     = (string) (input()['new_password'] ?? '');

    $hash = row('SELECT password_hash FROM users WHERE id = ?', [$userId])['password_hash'];
    if (!password_verify($current, $hash)) {
        fail('Kata sandi lama salah.', 422);
    }
    if (strlen($new) < 8) {
        fail('Kata sandi baru minimal 8 karakter.', 422);
    }
    run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), $userId]);
    json_out(['ok' => true]);
}

$name = str_in('name', $user['name']);
$bio  = str_in('bio', (string) $user['bio']);
if ($name === '' || mb_strlen($name) > 100) {
    fail('Nama wajib diisi (maks. 100 karakter).', 422);
}
if (mb_strlen($bio) > 255) {
    fail('Bio maksimal 255 karakter.', 422);
}

run('UPDATE users SET name = ?, bio = ? WHERE id = ?', [$name, $bio !== '' ? $bio : null, $userId]);
json_out(['user' => user_out(current_user())]);
