<?php
/*
 * STA2e Remote relay.
 *
 * The GM's MapTool (STA2e Remote add-on) and the players' browsers never talk to each other
 * directly. Players queue commands here; the add-on collects them, runs them in MapTool and
 * posts back the results and a snapshot of each connection's characters.
 *
 * All requests are POST with a JSON body: {"action": "...", ...}. Responses are JSON.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

const MAX_BODY = 262144;
const MAX_COMMANDS_KEPT = 150;
const MAX_PENDING_PER_CONNECTION = 5;
const COMMAND_TYPES = ['roll', 'rollAction', 'action', 'stress', 'determination', 'chat'];
const MAX_DEVICES_PER_CONNECTION = 10;
const PIN_MAX_FAILS = 5;            // wrong PINs in a row before the connection's PIN is locked...
const PIN_LOCK_SECONDS = 600;       // ...for this long
const REQUEST_TTL = 300;            // join requests the GM hasn't answered expire after this long
const MAX_PENDING_REQUESTS = 10;    // per campaign

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if (STA_ALLOW_ORIGIN !== '' && ($_SERVER['HTTP_ORIGIN'] ?? '') === STA_ALLOW_ORIGIN) {
    header('Access-Control-Allow-Origin: ' . STA_ALLOW_ORIGIN);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function out(array $data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $error, int $code = 400, array $extra = []): void {
    out(['ok' => false, 'error' => $error] + $extra, $code);
}
function rid(int $bytes = 9): string {
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}
function hsh(string $s): string { return hash('sha256', $s); }
function now(): float { return microtime(true); }
function str_field(array $a, string $k, int $max = 200): string {
    $v = $a[$k] ?? '';
    if (!is_string($v) && !is_numeric($v)) return '';
    return mb_substr(trim((string)$v), 0, $max);
}

/* ---------------- storage: one JSON file per campaign, locked while in use ---------------- */
final class Store {
    private $fh;
    public array $data;
    private function __construct($fh, array $data) { $this->fh = $fh; $this->data = $data; }

    // Files are .php and start with an exit line, so even if the data folder is reachable from the
    // web (no .htaccess support), requesting one returns nothing.
    const GUARD = "<?php exit; ?>\n";
    public static function path(string $id): string { return STA_DATA_DIR . '/c_' . $id . '.php'; }

    public static function open(string $id, bool $create = false): ?Store {
        if (!preg_match('/^[A-Za-z0-9_-]{8,32}$/', $id)) return null;
        $p = self::path($id);
        if (!$create && !is_file($p)) return null;
        if (!is_dir(STA_DATA_DIR) && !@mkdir(STA_DATA_DIR, 0770, true)) fail('storage', 500, ['detail' => 'Data folder missing and not creatable']);
        $fh = @fopen($p, 'c+');
        if (!$fh) fail('storage', 500, ['detail' => 'Data folder not writable']);
        flock($fh, LOCK_EX);
        $raw = (string)stream_get_contents($fh);
        if (strpos($raw, self::GUARD) === 0) $raw = substr($raw, strlen(self::GUARD));
        $data = $raw !== '' ? json_decode($raw, true) : null;
        return new Store($fh, is_array($data) ? $data : []);
    }
    /** Read a campaign without keeping it locked (for the lobby list). */
    public static function peek(string $path): ?array {
        $fh = @fopen($path, 'r');
        if (!$fh) return null;
        flock($fh, LOCK_SH);
        $raw = (string)stream_get_contents($fh);
        flock($fh, LOCK_UN);
        fclose($fh);
        if (strpos($raw, self::GUARD) === 0) $raw = substr($raw, strlen(self::GUARD));
        $d = json_decode($raw, true);
        return is_array($d) ? $d : null;
    }
    public function save(): void {
        $json = json_encode($this->data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        ftruncate($this->fh, 0);
        rewind($this->fh);
        fwrite($this->fh, self::GUARD . $json);
        fflush($this->fh);
    }
    public function __destruct() { if ($this->fh) { flock($this->fh, LOCK_UN); fclose($this->fh); } }
}

function gm_store(array $req): Store {
    $s = Store::open(str_field($req, 'campaign', 40));
    if (!$s) fail('unknownCampaign', 404);
    if (!hash_equals($s->data['gmKeyHash'] ?? '', hsh(str_field($req, 'gmKey', 100)))) fail('badKey', 403);
    return $s;
}
/** Player tokens look like "<campaign>.<connection>.<secret>". */
function player_store(array $req): array {
    $parts = explode('.', str_field($req, 'token', 120));
    if (count($parts) !== 3) fail('badToken', 403);
    [$cid, $conn, $secret] = $parts;
    $s = Store::open($cid);
    if (!$s) fail('badToken', 403);
    $c = $s->data['connections'][$conn] ?? null;
    if (!$c || !token_ok($c, $secret)) fail('badToken', 403);
    return [$s, $conn];
}
/** A connection accepts its original link and any device that joined from the lobby. */
function token_ok(array $c, string $secret): bool {
    $h = hsh($secret);
    if (hash_equals($c['tokenHash'] ?? '', $h)) return true;
    foreach (($c['devices'] ?? []) as $dev) if (hash_equals($dev['hash'] ?? '', $h)) return true;
    return false;
}
/** Give one more device a way in; returns the full player token. */
function add_device(array &$d, string $conn, string $label): string {
    $secret = rid(18);
    $devs = $d['connections'][$conn]['devices'] ?? [];
    $devs[] = ['hash' => hsh($secret), 'created' => now(), 'label' => $label];
    if (count($devs) > MAX_DEVICES_PER_CONNECTION) $devs = array_slice($devs, -MAX_DEVICES_PER_CONNECTION);
    $d['connections'][$conn]['devices'] = $devs;
    return $d['id'] . '.' . $conn . '.' . $secret;
}
function expire_requests(array &$d): void {
    $t = now();
    $keep = [];
    foreach (($d['requests'] ?? []) as $r) {
        if ($r['status'] === 'pending' && $t - $r['created'] > REQUEST_TTL) $r['status'] = 'expired';
        // answered requests are kept briefly so the requester can pick up the answer
        if ($t - $r['created'] < REQUEST_TTL * 2) $keep[] = $r;
    }
    $d['requests'] = $keep;
}
function char_names(array $d, string $conn): array {
    $snap = ((array)($d['snapshots'] ?? []))[$conn] ?? null;
    $out = [];
    foreach ((($snap['characters'] ?? []) ?: []) as $ch) if (isset($ch['name'])) $out[] = mb_substr((string)$ch['name'], 0, 60);
    return $out;
}
function lobby_store(array $req): Store {
    $s = Store::open(str_field($req, 'campaign', 40));
    if (!$s || now() - ($s->data['gmSeen'] ?? 0) >= STA_ONLINE_WINDOW) fail('notOnline', 404);
    return $s;
}
function expire_commands(array &$d): void {
    $t = now();
    foreach ($d['commands'] as &$c) {
        if (($c['status'] === 'new' || $c['status'] === 'sent') && $t - $c['created'] > STA_COMMAND_TTL) {
            $c['status'] = 'expired';
            $c['error'] = "The GM's MapTool didn't answer in time.";
        }
    }
    unset($c);
    if (count($d['commands']) > MAX_COMMANDS_KEPT) $d['commands'] = array_slice($d['commands'], -MAX_COMMANDS_KEPT);
}
function base_url(): string {
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api.php')), '/');
    return ($https ? 'https' : 'http') . '://' . $host . $dir;
}
function conn_list(array $d): array {
    $out = [];
    foreach ($d['connections'] as $id => $c) {
        $out[] = ['id' => $id, 'name' => $c['name'], 'created' => $c['created'], 'lastSeen' => $c['lastSeen'] ?? 0,
            'hasPin' => !empty($c['pinHash']), 'devices' => count($c['devices'] ?? [])];
    }
    return $out;
}

/* ---------------- request ---------------- */
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('usePost', 405);
$body = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($body === false || strlen($body) > MAX_BODY) fail('tooLarge', 413);
$req = json_decode($body, true);
if (!is_array($req)) fail('badJson');
$action = str_field($req, 'action', 40);

switch ($action) {
    case 'ping':
        // version 2 adds gm.rotateKey and gm.newLink.
        out(['ok' => true, 'service' => 'sta2e-remote', 'version' => 2, 'needsCreateKey' => STA_CREATE_KEY !== '']);

    case 'create': {
        if (STA_CREATE_KEY !== '' && !hash_equals(STA_CREATE_KEY, str_field($req, 'createKey', 200))) fail('badCreateKey', 403);
        $id = rid(9);
        $gmKey = rid(24);
        $s = Store::open($id, true);
        $s->data = ['id' => $id, 'gmKeyHash' => hsh($gmKey), 'created' => now(), 'gmSeen' => 0,
            'name' => str_field($req, 'name', 80), 'connections' => new stdClass(), 'snapshots' => new stdClass(), 'commands' => []];
        $s->save();
        out(['ok' => true, 'campaign' => $id, 'gmKey' => $gmKey]);
    }

    case 'gm.connect': {
        $s = gm_store($req);
        $name = str_field($req, 'name', 60);
        if ($name === '') fail('nameRequired');
        $d = &$s->data;
        $d['connections'] = (array)$d['connections'];
        if (count($d['connections']) >= 40) fail('tooManyConnections');
        $conn = rid(6);
        $secret = rid(18);
        $d['connections'][$conn] = ['name' => $name, 'tokenHash' => hsh($secret), 'created' => now(), 'lastSeen' => 0];
        $s->save();
        $token = $d['id'] . '.' . $conn . '.' . $secret;
        out(['ok' => true, 'id' => $conn, 'token' => $token, 'join' => base_url() . '/player/#t=' . $token]);
    }

    case 'gm.rotateKey': {
        // A new GM key; the old one stops working at once. The add-on keeps the key in the campaign,
        // where players' MapTool clients can read it, so the GM can issue a new one whenever needed.
        $s = gm_store($req);
        $gmKey = rid(24);
        $s->data['gmKeyHash'] = hsh($gmKey);
        $s->save();
        out(['ok' => true, 'gmKey' => $gmKey]);
    }

    case 'gm.newLink': {
        // A new join link for one connection; the old link stops working. Devices the GM approved
        // from the lobby keep working, unless signOutDevices is set.
        $s = gm_store($req);
        $d = &$s->data;
        $d['connections'] = (array)$d['connections'];
        $conn = str_field($req, 'id', 20);
        if (!isset($d['connections'][$conn])) fail('unknownConnection', 404);
        $secret = rid(18);
        $d['connections'][$conn]['tokenHash'] = hsh($secret);
        if (!empty($req['signOutDevices'])) $d['connections'][$conn]['devices'] = [];
        $s->save();
        $token = $d['id'] . '.' . $conn . '.' . $secret;
        out(['ok' => true, 'id' => $conn, 'token' => $token, 'join' => base_url() . '/player/#t=' . $token]);
    }

    case 'gm.disconnect': {
        $s = gm_store($req);
        $d = &$s->data;
        $conn = str_field($req, 'id', 20);
        $d['connections'] = (array)$d['connections'];
        $d['snapshots'] = (array)$d['snapshots'];
        unset($d['connections'][$conn], $d['snapshots'][$conn]);
        foreach ($d['commands'] as &$c) if ($c['cid'] === $conn && in_array($c['status'], ['new', 'sent'], true)) $c['status'] = 'cancelled';
        unset($c);
        $s->save();
        out(['ok' => true]);
    }

    case 'gm.sync': {
        // In: results of commands the add-on ran, and fresh snapshots. Out: new commands and the connection list.
        $s = gm_store($req);
        $d = &$s->data;
        $d['connections'] = (array)$d['connections'];
        $d['snapshots'] = (array)$d['snapshots'];
        $d['gmSeen'] = now();
        // The add-on's actions list, sent when it changes; players' pages fetch it once.
        if (isset($req['catalog']) && is_array($req['catalog'])) {
            $d['catalog'] = $req['catalog'];
            $d['catalogVersion'] = str_field($req['catalog'], 'version', 60);
        }
        $byId = [];
        foreach ($d['commands'] as $i => $c) $byId[$c['id']] = $i;
        foreach ((array)($req['results'] ?? []) as $r) {
            if (!is_array($r)) continue;
            $i = $byId[(string)($r['id'] ?? '')] ?? null;
            if ($i === null) continue;
            $d['commands'][$i]['status'] = !empty($r['ok']) ? 'done' : 'error';
            $d['commands'][$i]['result'] = $r['result'] ?? null;
            $d['commands'][$i]['error'] = isset($r['error']) ? mb_substr((string)$r['error'], 0, 300) : null;
            $d['commands'][$i]['finished'] = now();
        }
        foreach ((array)($req['snapshots'] ?? []) as $conn => $snap) {
            if (isset($d['connections'][$conn]) && is_array($snap)) $d['snapshots'][$conn] = $snap + ['at' => now()];
        }
        expire_commands($d);
        $send = [];
        foreach ($d['commands'] as &$c) {
            if ($c['status'] === 'new' && isset($d['connections'][$c['cid']])) {
                $c['status'] = 'sent';
                $send[] = ['id' => $c['id'], 'cid' => $c['cid'], 'cmd' => $c['cmd'], 'created' => $c['created']];
            }
        }
        unset($c);
        expire_requests($d);
        $pendingReq = [];
        foreach ($d['requests'] as $r) {
            if ($r['status'] === 'pending' && isset($d['connections'][$r['conn']])) {
                $pendingReq[] = ['id' => $r['id'], 'conn' => $r['conn'], 'name' => $r['name'], 'created' => $r['created']];
            }
        }
        $s->save();
        out(['ok' => true, 'commands' => $send, 'connections' => conn_list($d), 'requests' => $pendingReq,
            'name' => $d['name'] ?? '', 'catalogVersion' => $d['catalogVersion'] ?? '', 'now' => now()]);
    }

    case 'player.state': {
        [$s, $conn] = player_store($req);
        $d = &$s->data;
        $d['connections'][$conn]['lastSeen'] = now();
        expire_commands($d);
        $results = [];
        foreach ($d['commands'] as $c) {
            if ($c['cid'] !== $conn) continue;
            $results[] = ['id' => $c['id'], 'type' => $c['cmd']['type'] ?? '', 'status' => $c['status'],
                'result' => $c['result'] ?? null, 'error' => $c['error'] ?? null, 'created' => $c['created']];
        }
        $s->save();
        $state = ['ok' => true, 'name' => $d['connections'][$conn]['name'],
            'gmOnline' => now() - ($d['gmSeen'] ?? 0) < STA_ONLINE_WINDOW,
            'snapshot' => ((array)$d['snapshots'])[$conn] ?? null,
            'results' => array_slice($results, -20), 'now' => now()];
        $cv = $d['catalogVersion'] ?? '';
        if ($cv !== '' && str_field($req, 'catalogVersion', 60) !== $cv) { $state['catalog'] = $d['catalog']; $state['catalogVersion'] = $cv; }
        out($state);
    }

    case 'player.command': {
        [$s, $conn] = player_store($req);
        $d = &$s->data;
        $cmd = $req['cmd'] ?? null;
        if (!is_array($cmd) || !in_array($cmd['type'] ?? '', COMMAND_TYPES, true)) fail('badCommand');
        if (strlen(json_encode($cmd)) > 4000) fail('tooLarge', 413);
        expire_commands($d);
        $pending = 0;
        foreach ($d['commands'] as $c) if ($c['cid'] === $conn && in_array($c['status'], ['new', 'sent'], true)) $pending++;
        if ($pending >= MAX_PENDING_PER_CONNECTION) fail('busy', 429);
        $id = rid(6);
        $d['commands'][] = ['id' => $id, 'cid' => $conn, 'cmd' => $cmd, 'status' => 'new', 'created' => now()];
        $d['connections'][$conn]['lastSeen'] = now();
        $s->save();
        out(['ok' => true, 'id' => $id]);
    }

    /* ---------------- GM: PINs, campaign name, join requests ---------------- */
    case 'gm.setPin': {
        $s = gm_store($req);
        $d = &$s->data;
        $conn = str_field($req, 'id', 20);
        if (!isset($d['connections'][$conn])) fail('unknownConnection', 404);
        $pin = str_field($req, 'pin', 20);
        if ($pin !== '' && !preg_match('/^\d{4,8}$/', $pin)) fail('badPin');
        if ($pin === '') unset($d['connections'][$conn]['pinHash']);
        else $d['connections'][$conn]['pinHash'] = password_hash($pin, PASSWORD_DEFAULT);
        $d['connections'][$conn]['pinFails'] = 0;
        $d['connections'][$conn]['pinLockUntil'] = 0;
        $s->save();
        out(['ok' => true, 'hasPin' => $pin !== '']);
    }

    case 'gm.rename': {
        $s = gm_store($req);
        $s->data['name'] = str_field($req, 'name', 80);
        $s->save();
        out(['ok' => true]);
    }

    case 'gm.approve': {
        $s = gm_store($req);
        $d = &$s->data;
        expire_requests($d);
        $rid = str_field($req, 'request', 20);
        foreach ($d['requests'] as &$r) {
            if ($r['id'] !== $rid) continue;
            if ($r['status'] !== 'pending' || !isset($d['connections'][$r['conn']])) fail('requestGone', 404);
            if (!empty($req['approve'])) {
                $r['status'] = 'approved';
                $r['token'] = add_device($d, $r['conn'], 'approved: ' . $r['name']);   // handed over once, then deleted
            } else {
                $r['status'] = 'denied';
            }
            $r['answered'] = now();
            unset($r);
            $s->save();
            out(['ok' => true]);
        }
        unset($r);
        fail('requestGone', 404);
    }

    /* ---------------- lobby (public) ---------------- */
    case 'lobby.list': {
        // Only campaigns whose GM is connected right now, so nothing is advertised between sessions.
        $list = [];
        foreach ((glob(STA_DATA_DIR . '/c_*.php') ?: []) as $path) {
            if (now() - filemtime($path) > STA_ONLINE_WINDOW + 5) continue;   // cheap pre-check before reading
            $d = Store::peek($path);
            if (!$d || now() - ($d['gmSeen'] ?? 0) >= STA_ONLINE_WINDOW) continue;
            $conns = [];
            foreach ((array)($d['connections'] ?? []) as $id => $c) {
                $conns[] = ['id' => (string)$id, 'name' => $c['name'], 'hasPin' => !empty($c['pinHash']),
                    'characters' => char_names($d, (string)$id), 'online' => now() - ($c['lastSeen'] ?? 0) < 15];
            }
            if (!$conns) continue;
            $list[] = ['campaign' => $d['id'], 'name' => ($d['name'] ?? '') !== '' ? $d['name'] : 'STA 2E game', 'connections' => $conns];
        }
        out(['ok' => true, 'campaigns' => $list]);
    }

    case 'lobby.join': {
        $s = lobby_store($req);
        $d = &$s->data;
        $conn = str_field($req, 'conn', 20);
        $c = $d['connections'][$conn] ?? null;
        if (!$c) fail('unknownConnection', 404);
        if (empty($c['pinHash'])) fail('noPin');
        if (($c['pinLockUntil'] ?? 0) > now()) fail('pinLocked', 429, ['retryIn' => (int)ceil($c['pinLockUntil'] - now())]);
        if (!password_verify(str_field($req, 'pin', 20), $c['pinHash'])) {
            $fails = ($c['pinFails'] ?? 0) + 1;
            $d['connections'][$conn]['pinFails'] = $fails;
            if ($fails >= PIN_MAX_FAILS) { $d['connections'][$conn]['pinLockUntil'] = now() + PIN_LOCK_SECONDS; $d['connections'][$conn]['pinFails'] = 0; }
            $s->save();
            fail('badPin', 403, ['left' => max(0, PIN_MAX_FAILS - $fails)]);
        }
        $d['connections'][$conn]['pinFails'] = 0;
        $token = add_device($d, $conn, 'pin');
        $s->save();
        out(['ok' => true, 'token' => $token]);
    }

    case 'lobby.request': {
        $s = lobby_store($req);
        $d = &$s->data;
        $conn = str_field($req, 'conn', 20);
        if (!isset($d['connections'][$conn])) fail('unknownConnection', 404);
        $name = str_field($req, 'name', 40);
        if ($name === '') fail('nameRequired');
        expire_requests($d);
        $pending = 0;
        foreach ($d['requests'] as $r) if ($r['status'] === 'pending') $pending++;
        if ($pending >= MAX_PENDING_REQUESTS) fail('busy', 429);
        $id = rid(6);
        $key = rid(18);
        $d['requests'][] = ['id' => $id, 'keyHash' => hsh($key), 'conn' => $conn, 'name' => $name, 'status' => 'pending', 'created' => now()];
        $s->save();
        out(['ok' => true, 'request' => $id, 'key' => $key]);
    }

    case 'lobby.poll': {
        $s = Store::open(str_field($req, 'campaign', 40));
        if (!$s) fail('requestGone', 404);
        $d = &$s->data;
        expire_requests($d);
        $rid = str_field($req, 'request', 20);
        foreach ($d['requests'] as $i => $r) {
            if ($r['id'] !== $rid) continue;
            if (!hash_equals($r['keyHash'], hsh(str_field($req, 'key', 60)))) fail('requestGone', 404);
            $answer = ['ok' => true, 'status' => $r['status']];
            if ($r['status'] === 'approved' && isset($r['token'])) {
                $answer['token'] = $r['token'];
                unset($d['requests'][$i]['token']);   // one pick-up only
                $d['requests'][$i]['status'] = 'collected';
                $d['requests'] = array_values($d['requests']);
                $s->save();
            } elseif ($r['status'] !== 'pending') {
                $s->save();
            }
            out($answer);
        }
        fail('requestGone', 404);
    }

    default:
        fail('unknownAction');
}
