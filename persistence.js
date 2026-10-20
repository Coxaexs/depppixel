// 💾 Persistence: save/load, crash-safe autosave, player stats + leaderboard, replays.
// Everything is plain JSON on disk under DATA_DIR (default ./data) — no database needed.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DIRS = {
    saves: path.join(DATA_DIR, "saves"),
    replays: path.join(DATA_DIR, "replays"),
    active: path.join(DATA_DIR, "active"),
};
const STATS_FILE = path.join(DATA_DIR, "stats.json");

const MAX_SAVES_PER_PROFILE = 20;
const MAX_REPLAY_FRAMES = 5000;
const MAX_REPLAYS_KEPT = 500;
const ACTIVE_MAX_AGE = 24 * 60 * 60 * 1000; // don't resurrect games idle for over a day

for (const dir of Object.values(DIRS)) fs.mkdirSync(dir, { recursive: true });

// ---------- helpers ----------
function writeJsonAtomic(file, data) {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
}

function readJson(file, fallback = null) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        return fallback;
    }
}

const safeId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);
const newId = () => crypto.randomBytes(6).toString("hex");
// Public alias for a profile — the raw profileId acts as a secret (it lists your saves)
const publicId = (profileId) =>
    crypto.createHash("sha256").update(String(profileId)).digest("hex").slice(0, 12);

// Fields that are runtime-only and should never be persisted or restored
const RUNTIME_FIELDS = [
    "voiceChat",
    "inactivityWarningShown",
    "inactivityWarningTime",
    "humanPlayerMissedTurns",
];

function cleanClone(game) {
    const copy = JSON.parse(JSON.stringify(game));
    for (const f of RUNTIME_FIELDS) delete copy[f];
    return copy;
}

function netWorth(game, player) {
    let worth = player.money || 0;
    const board = game.settings?.board || [];
    (game.properties || []).forEach((prop, i) => {
        const space = board[i];
        if (!space) return;
        let share = 0;
        if (prop.owners && prop.owners[player.id] > 0) share = prop.owners[player.id] / 100;
        else if (prop.ownerId === player.id) share = 1;
        if (!share) return;
        const value = prop.mortgaged ? (space.price || 0) / 2 : space.price || 0;
        worth += value * share + (prop.houses || 0) * (space.houseCost || 50) * share;
    });
    return Math.floor(worth);
}

function propertyCount(game, player) {
    return (game.properties || []).filter(
        (p) => p.ownerId === player.id || (p.owners && p.owners[player.id] > 0),
    ).length;
}

// ---------- replays ----------
// gameId -> { id, startedAt, dir: {playerId: key}, players: {key: meta}, frames, lastLogLen, lastKey, finalized }
const recorders = new Map();

function getRecorder(game) {
    let rec = recorders.get(game.gameId);
    if (!rec) {
        rec = {
            id: `${game.gameId}-${Date.now().toString(36)}`,
            startedAt: Date.now(),
            dir: {},
            players: {},
            frames: [],
            lastLogLen: 0,
            lastKey: "",
            finalized: false,
        };
        recorders.set(game.gameId, rec);
    }
    return rec;
}

// Seats keep one key even if their player id changes (reclaimed after a save was loaded)
function playerKey(rec, player) {
    if (!rec.dir[player.id]) {
        rec.byProfile ||= {};
        let key = player.profileId && rec.byProfile[player.profileId];
        if (!key) {
            key = `p${Object.keys(rec.players).length}`;
            rec.players[key] = { name: player.name, color: player.color, isBot: !!player.isBot };
            if (player.profileId) rec.byProfile[player.profileId] = key;
        }
        rec.dir[player.id] = key;
    }
    return rec.dir[player.id];
}

function recordFrame(game) {
    if (game.state !== "playing" && game.state !== "finished") return;
    const rec = getRecorder(game);
    if (rec.finalized || rec.frames.length >= MAX_REPLAY_FRAMES) return;

    const players = game.players.map((p) => ({
        k: playerKey(rec, p),
        pos: p.position || 0,
        $: p.money || 0,
        b: p.isBankrupt ? 1 : 0,
        j: p.inJail ? 1 : 0,
    }));
    const props = (game.properties || []).map((p) =>
        p.ownerId ? [rec.dir[p.ownerId] || null, p.houses || 0, p.mortgaged ? 1 : 0] : 0,
    );
    const cur = game.currentPlayerIndex || 0;
    const dice = game.lastDiceRoll || [0, 0];

    const log = game.gameLog || [];
    if (log.length < rec.lastLogLen) rec.lastLogLen = 0; // log was replaced/trimmed by a client
    const newLog = log.slice(rec.lastLogLen, rec.lastLogLen + 20);
    rec.lastLogLen = log.length;

    const key = JSON.stringify([players, props, cur, dice, game.state]);
    if (key === rec.lastKey && newLog.length === 0) return; // periodic resync, nothing changed
    rec.lastKey = key;

    rec.frames.push({ t: Date.now() - rec.startedAt, players, props, cur, dice, log: newLog });
}

function writeReplay(game, rec, result) {
    const board = (game.settings?.board || []).map((s) => ({
        name: s.name,
        type: s.type,
        color: s.color || null,
        price: s.price || 0,
    }));
    const replay = {
        id: rec.id,
        gameId: game.gameId,
        startedAt: rec.startedAt,
        endedAt: Date.now(),
        map: game.settings?.map || "classic",
        board,
        players: rec.players,
        winner: result.winnerId ? rec.dir[result.winnerId] || null : null,
        frames: rec.frames,
    };
    writeJsonAtomic(path.join(DIRS.replays, `${rec.id}.json`), replay);
    pruneReplays();
    return replay;
}

function pruneReplays() {
    const files = fs.readdirSync(DIRS.replays).filter((f) => f.endsWith(".json"));
    if (files.length <= MAX_REPLAYS_KEPT) return;
    files
        .map((f) => ({ f, m: fs.statSync(path.join(DIRS.replays, f)).mtimeMs }))
        .sort((a, b) => a.m - b.m)
        .slice(0, files.length - MAX_REPLAYS_KEPT)
        .forEach(({ f }) => fs.unlinkSync(path.join(DIRS.replays, f)));
}

// Small index so /api/replays doesn't parse every replay file
const REPLAY_INDEX = path.join(DATA_DIR, "replay-index.json");
function addToReplayIndex(replay) {
    const index = readJson(REPLAY_INDEX, []);
    index.unshift({
        id: replay.id,
        startedAt: replay.startedAt,
        endedAt: replay.endedAt,
        map: replay.map,
        frames: replay.frames.length,
        players: Object.values(replay.players).map((p) => ({ name: p.name, color: p.color, isBot: p.isBot })),
        winner: replay.winner ? replay.players[replay.winner]?.name : null,
    });
    const existing = new Set(
        fs.readdirSync(DIRS.replays).map((f) => f.replace(/\.json$/, "")),
    );
    writeJsonAtomic(REPLAY_INDEX, index.filter((r) => existing.has(r.id)));
}

// ---------- stats ----------
let stats = readJson(STATS_FILE, { profiles: {} });

function updateStats(game, winnerId) {
    for (const p of game.players) {
        if (p.isBot || !p.profileId) continue;
        const s = (stats.profiles[p.profileId] ||= {
            publicId: publicId(p.profileId),
            name: p.name,
            gamesPlayed: 0,
            wins: 0,
            bankruptcies: 0,
            totalNetWorth: 0,
            bestNetWorth: 0,
            totalRentCollected: 0,
            totalRentPaid: 0,
            totalTurns: 0,
            totalProperties: 0,
            firstPlayed: Date.now(),
            lastPlayed: 0,
            recent: [],
        });
        const worth = netWorth(game, p);
        const won = p.id === winnerId;
        s.name = p.name;
        s.gamesPlayed++;
        if (won) s.wins++;
        if (p.isBankrupt) s.bankruptcies++;
        s.totalNetWorth += worth;
        s.bestNetWorth = Math.max(s.bestNetWorth, worth);
        s.totalRentCollected += p.rentCollected || 0;
        s.totalRentPaid += p.rentPaid || 0;
        s.totalTurns += p.turnsPlayed || 0;
        s.totalProperties += propertyCount(game, p);
        s.lastPlayed = Date.now();
        s.recent.unshift({
            at: Date.now(),
            won,
            bankrupt: !!p.isBankrupt,
            netWorth: worth,
            players: game.players.length,
            map: game.settings?.map || "classic",
            replayId: recorders.get(game.gameId)?.id || null,
        });
        s.recent = s.recent.slice(0, 20);
    }
    writeJsonAtomic(STATS_FILE, stats);
}

function pickWinner(game) {
    if (game.winner?.id) return game.winner.id;
    const alive = game.players.filter((p) => !p.isBankrupt);
    const pool = alive.length ? alive : game.players;
    let best = null;
    for (const p of pool) if (!best || netWorth(game, p) > netWorth(game, best)) best = p;
    return best ? best.id : null;
}

function finalizeGame(game) {
    const rec = recorders.get(game.gameId);
    if (rec?.finalized) return;
    // A game that never really got going (no dice ever rolled) isn't worth a record
    if (!rec || rec.frames.length < 2) {
        recorders.delete(game.gameId);
        removeActive(game.gameId);
        return;
    }
    rec.finalized = true;
    const winnerId = pickWinner(game);
    try {
        const replay = writeReplay(game, rec, { winnerId });
        addToReplayIndex(replay);
        game.replayId = replay.id; // lets the game-over screen link to it
    } catch (e) {
        console.error("❌ Failed to write replay:", e);
    }
    try {
        updateStats(game, winnerId);
    } catch (e) {
        console.error("❌ Failed to update stats:", e);
    }
    removeActive(game.gameId);
    console.log(`📊 Game ${game.gameId} recorded (replay ${rec.id})`);
}

function getLeaderboard(limit = 50) {
    return Object.values(stats.profiles)
        .filter((s) => s.gamesPlayed > 0)
        .map((s) => ({
            publicId: s.publicId,
            name: s.name,
            gamesPlayed: s.gamesPlayed,
            wins: s.wins,
            winRate: Math.round((s.wins / s.gamesPlayed) * 100),
            bestNetWorth: s.bestNetWorth,
            avgNetWorth: Math.round(s.totalNetWorth / s.gamesPlayed),
            lastPlayed: s.lastPlayed,
        }))
        .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.bestNetWorth - a.bestNetWorth)
        .slice(0, limit);
}

function getProfileStats(profileId) {
    const s = stats.profiles[profileId];
    if (!s) return null;
    const rank = getLeaderboard(Infinity).findIndex((r) => r.publicId === s.publicId) + 1;
    return { ...s, rank: rank || null };
}

// ---------- autosave of live games (survives server restarts) ----------
const dirty = new Set();

function onGameState(game) {
    if (!game || !game.gameId) return;
    try {
        recordFrame(game);
    } catch (e) {
        console.error("❌ Replay recording failed:", e);
    }
    if (game.state === "finished") finalizeGame(game);
    else dirty.add(game.gameId);
}

function removeActive(gameId) {
    dirty.delete(gameId);
    fs.rm(path.join(DIRS.active, `${gameId}.json`), { force: true }, () => {});
}

function flushActive(games) {
    for (const gameId of dirty) {
        const game = games.get(gameId);
        if (!game || game.state === "finished") continue;
        try {
            const rec = recorders.get(gameId);
            writeJsonAtomic(path.join(DIRS.active, `${gameId}.json`), {
                savedAt: Date.now(),
                game: cleanClone(game),
                recorder: rec && !rec.finalized ? rec : null,
            });
        } catch (e) {
            console.error(`❌ Autosave failed for ${gameId}:`, e);
        }
    }
    dirty.clear();
}

function restoreActive(games) {
    let restored = 0;
    for (const f of fs.readdirSync(DIRS.active)) {
        if (!f.endsWith(".json")) continue;
        const file = path.join(DIRS.active, f);
        const data = readJson(file);
        if (!data?.game?.gameId || Date.now() - data.savedAt > ACTIVE_MAX_AGE) {
            fs.rmSync(file, { force: true });
            continue;
        }
        const game = data.game;
        game.voiceChat = [];
        game.lastActivity = Date.now();
        game.inactivityWarningShown = false;
        game.humanPlayerMissedTurns = {};
        games.set(game.gameId, game);
        if (data.recorder) recorders.set(game.gameId, data.recorder);
        restored++;
    }
    if (restored) console.log(`♻️ Restored ${restored} game(s) from autosave`);
}

function forgetGame(gameId) {
    recorders.delete(gameId);
    removeActive(gameId);
}

// ---------- manual save slots ----------
function saveGame(game, profileId, name) {
    if (!profileId) throw new Error("Missing profile");
    if (game.state === "finished") throw new Error("Finished games can't be saved");
    const saves = listSaves(profileId);
    if (saves.length >= MAX_SAVES_PER_PROFILE) {
        // Drop the oldest slot to make room
        fs.rmSync(path.join(DIRS.saves, `${saves[saves.length - 1].id}.json`), { force: true });
    }
    const id = newId();
    const snapshot = cleanClone(game);
    delete snapshot.trade;
    delete snapshot.auction;
    const save = {
        id,
        owner: profileId,
        name: String(name || "").trim().slice(0, 40) || `Game ${game.gameId}`,
        createdAt: Date.now(),
        summary: {
            gameId: game.gameId,
            state: game.state,
            map: game.settings?.map || "classic",
            players: game.players.map((p) => ({ name: p.name, color: p.color, isBot: !!p.isBot, money: p.money })),
            turn: game.players[game.currentPlayerIndex]?.name || null,
        },
        game: snapshot,
    };
    writeJsonAtomic(path.join(DIRS.saves, `${id}.json`), save);
    return { id, name: save.name, createdAt: save.createdAt, summary: save.summary };
}

function listSaves(profileId) {
    if (!profileId) return [];
    return fs
        .readdirSync(DIRS.saves)
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJson(path.join(DIRS.saves, f)))
        .filter((s) => s && s.owner === profileId)
        .map(({ id, name, createdAt, summary }) => ({ id, name, createdAt, summary }))
        .sort((a, b) => b.createdAt - a.createdAt);
}

function getSave(saveId, profileId) {
    if (!safeId(saveId)) return null;
    const save = readJson(path.join(DIRS.saves, `${saveId}.json`));
    return save && save.owner === profileId ? save : null;
}

function deleteSave(saveId, profileId) {
    if (!getSave(saveId, profileId)) return false;
    fs.rmSync(path.join(DIRS.saves, `${saveId}.json`), { force: true });
    return true;
}

// Swap a seat's player id everywhere it's referenced (used when someone reclaims a seat)
function remapPlayerId(game, oldId, newId) {
    if (oldId === newId) return;
    for (const p of game.players) if (p.id === oldId) p.id = newId;
    for (const prop of game.properties || []) {
        if (prop.ownerId === oldId) prop.ownerId = newId;
        if (prop.owners && oldId in prop.owners) {
            prop.owners[newId] = prop.owners[oldId];
            delete prop.owners[oldId];
        }
    }
    if (game.hostId === oldId) game.hostId = newId;
    if (game.winner?.id === oldId) game.winner.id = newId;
}

// Replay/stats files are the only things served over HTTP; saves stay private
function getReplay(id) {
    return safeId(id) ? readJson(path.join(DIRS.replays, `${id}.json`)) : null;
}

function listReplays(limit = 50) {
    return readJson(REPLAY_INDEX, []).slice(0, limit);
}

module.exports = {
    DATA_DIR,
    onGameState,
    flushActive,
    restoreActive,
    forgetGame,
    saveGame,
    listSaves,
    getSave,
    deleteSave,
    remapPlayerId,
    getLeaderboard,
    getProfileStats,
    getReplay,
    listReplays,
};
