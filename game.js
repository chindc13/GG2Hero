(() => {
  "use strict";

  const canvas = document.querySelector("#board");
  const context = canvas.getContext("2d");
  const scoreElement = document.querySelector("#score");
  const comboElement = document.querySelector("#combo");
  const multiplierElement = document.querySelector("#multiplier");
  const rockFill = document.querySelector("#rock-fill");
  const rockMeter = document.querySelector("#rock-meter");
  const menuOverlay = document.querySelector("#menu-overlay");
  const mainMenu = document.querySelector("#main-menu");
  const setupScreen = document.querySelector("#setup-screen");
  const optionsScreen = document.querySelector("#options-screen");
  const setupTitle = document.querySelector("#setup-title");
  const setupDescription = document.querySelector("#setup-description");
  const setupNote = document.querySelector("#setup-note");
  const difficultyControl = document.querySelector("#difficulty-control");
  const difficultySelect = document.querySelector("#difficulty");
  const songSelect = document.querySelector("#song-select");
  const setupSongTitle = document.querySelector("#setup-song-title");
  const setupAlbumArt = document.querySelector("#setup-album-art");
  const currentSongLabel = document.querySelector("#current-song");
  const youtubeBackground = document.querySelector("#youtube-background");
  const songLibraryStatus = setupNote;
  const defaultDifficulty = document.querySelector("#default-difficulty");
  const soundSetting = document.querySelector("#sound-setting");
  const startButton = document.querySelector("#start");
  const saveOptionsButton = document.querySelector("#save-options");
  const resultsOverlay = document.querySelector("#results-overlay");
  const resultsKicker = document.querySelector("#results-kicker");
  const resultsTitle = document.querySelector("#message-title");
  const resultsMessage = document.querySelector("#message");
  const resultAction = document.querySelector("#result-action");
  const resultMenu = document.querySelector("#result-menu");
  const feedbackElement = document.querySelector("#feedback");
  const controllerStatus = document.querySelector("#controller-status");
  const clockStatus = document.querySelector("#clock-status");
  const menuButtons = [...document.querySelectorAll(".menu-option")];
  const backButtons = [...document.querySelectorAll('[data-action="back"]')];
  const fretButtons = [...document.querySelectorAll(".fret")];

  const laneCount = 5;
  const laneKeys = ["a", "s", "d", "j", "k"];
  const gamepadButtons = [7, 5, 6, 4, 0];
  const laneColors = ["#63ed54", "#f34d59", "#f5dc45", "#47bcf3", "#f59a38"];
  const laneFrequencies = [196, 220, 261.63, 293.66, 329.63];
  const beatMs = 500;
  const approachMs = 1900;
  const approachSeconds = approachMs / 1000;
  const highwayHorizonY = 2;
  const hitLineY = 445;
  const highwayTopHalfWidth = 137;
  const highwayBottomHalfWidth = 266;
  const noteLengthMs = 90;
  const beatSeconds = beatMs / 1000;
  const settings = {
    easy: { hitWindow: 220, density: 0.68 },
    medium: { hitWindow: 170, density: 0.84 },
    hard: { hitWindow: 130, density: 1 },
  };
  const beatPattern = [
    [0], [1], [2], [3], [4], [2, 4], [1, 3], [0],
    [4], [3], [2], [1], [0], [1, 4], [0, 3], [2],
  ];
  const activeLanes = new Set();
  const keyboardLanes = new Set();
  const gamepadLanes = new Set();
  const pointerLanes = new Set();
  const previousGamepadLanes = new Set();
  const pendingInputLanes = new Set();
  const laneHitUntil = Array.from({ length: laneCount }, () => 0);
  const fretButtonByLane = new Map(
    fretButtons.map((button) => [Number(button.dataset.lane), button]),
  );

  let chart = [];
  let songLibrary = [];
  let currentTrack;
  let youtubePlayer;
  let youtubeApiPromise;
  let youtubePlayerReady = false;
  let youtubePreRoll = false;
  let youtubePreRollTimer;
  let youtubeStartResolve;
  let youtubeStartReject;
  let youtubeClockAnchorMs = 0;
  let youtubeClockAnchorPerformance = 0;
  let youtubeClockRunning = false;
  let localAudio;
  let localAudioReady = false;
  let localAudioPreRoll = false;
  let localAudioPreRollTimer;
  let score = 0;
  let combo = 0;
  let bestCombo = 0;
  let rock = 50;
  let songStartAudioTime = 0;
  let songStartPerformanceTime = 0;
  let running = false;
  let audioContext;
  let animationFrame;
  let feedbackTimeout;
  let inputTimeout;
  let pendingInputAt = 0;
  let noiseBuffer;
  let selectedMenuIndex = 0;
  let currentScreen = "menu";
  let currentMode = "quickplay";
  let currentPlayer = 1;
  let multiplayerScores = [];
  let careerStage = 1;
  let selectedDifficulty = "medium";

  function songTimeMs() {
    if (currentTrack?.audioUrl && localAudioReady) {
      return localAudioPreRoll
        ? performance.now() - songStartPerformanceTime
        : localAudio.currentTime * 1000;
    }
    if (currentTrack?.youtubeVideoId && youtubePlayerReady && youtubePreRoll) {
      return performance.now() - songStartPerformanceTime;
    }
    if (currentTrack?.youtubeVideoId && youtubePlayerReady) {
      return youtubeClockAnchorMs + (youtubeClockRunning
        ? performance.now() - youtubeClockAnchorPerformance
        : 0);
    }
    if (audioContext) return (audioContext.currentTime - songStartAudioTime) * 1000;
    return performance.now() - songStartPerformanceTime;
  }

  function getTrack(id = songSelect.value) {
    return songLibrary.find((track) => track.id === id);
  }

  function getTrackChart(track, difficulty = difficultySelect.value) {
    if (track?.type === "practice") return makeChart(difficulty);
    const notes = track?.charts?.[difficulty];
    if (!Array.isArray(notes) || notes.length === 0) return null;
    return notes.map((note) => ({
      time: note.timeMs,
      lanes: note.lanes,
      hit: false,
      missed: false,
    }));
  }

  function setPointerFret(lane, held) {
    if (held) pointerLanes.add(lane);
    else pointerLanes.delete(lane);
    updateActiveFrets();
  }

  function updateSongLabel() {
    currentTrack = getTrack();
    if (!currentTrack) return;
    setupSongTitle.textContent = currentTrack.artist
      ? `${currentTrack.title} — ${currentTrack.artist}`
      : currentTrack.title;
    const isPracticeTrack = currentTrack.type === "practice";
    const usesLocalAudio = Boolean(currentTrack.audioUrl);
    setupAlbumArt.src = currentTrack.albumArtUrl || "assets/song-poster.png";
    setupAlbumArt.alt = `${currentTrack.title} album artwork`;
    currentSongLabel.textContent = isPracticeTrack ? "Practice Riff" : currentTrack.title;
    setupNote.hidden = true;
    setupNote.textContent = "";
    const notes = getTrackChart(currentTrack);
    const chartReady = isPracticeTrack || (
      Boolean(currentTrack.audioUrl || currentTrack.youtubeVideoId)
      && notes?.length > 0
    );
    startButton.disabled = !chartReady || (!isPracticeTrack && (
      usesLocalAudio ? !localAudioReady : !youtubePlayerReady
    ));
  }

  function parseYouTubeVideoId(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`Invalid YouTube URL: ${value}`);
    }
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      throw new Error(`Use a youtube.com or youtu.be URL: ${value}`);
    }
    if (url.pathname === "/watch") return url.searchParams.get("v") ?? "";
    const segments = url.pathname.split("/").filter(Boolean);
    return ["embed", "shorts", "live"].includes(segments[0]) ? segments[1] ?? "" : "";
  }

  function validateSongLibrary(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.songs)) {
      throw new Error("Expected a version 1 JSON file with a songs array.");
    }
    const ids = new Set();
    return data.songs.map((item, index) => {
      if (!item || typeof item.id !== "string" || typeof item.title !== "string" || !item.id || !item.title) {
        throw new Error(`Song ${index + 1} needs a non-empty id and title.`);
      }
      if (ids.has(item.id)) throw new Error(`Duplicate song id: ${item.id}`);
      ids.add(item.id);
      if (item.type === "practice") return { ...item, youtubeVideoId: "" };
      for (const mediaField of ["audioUrl", "midiUrl", "chartUrl", "albumArtUrl"]) {
        if (item[mediaField] !== undefined
          && (typeof item[mediaField] !== "string" || !item[mediaField].trim())) {
          throw new Error(`${item.title}: ${mediaField} must be a non-empty URL or path.`);
        }
      }
      const youtubeVideoId = parseYouTubeVideoId(item.youtubeUrl);
      return { ...item, youtubeVideoId, charts: item.charts ?? {} };
    });
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (youtubeApiPromise) return youtubeApiPromise;
    youtubeApiPromise = new Promise((resolve, reject) => {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = () => reject(new Error("Could not load the YouTube player API. Check your internet connection."));
      document.head.append(script);
    });
    return youtubeApiPromise;
  }

  async function prepareYouTubeTrack(track) {
    youtubePlayerReady = false;
    if (youtubePlayer) {
      youtubePlayer.destroy();
      youtubePlayer = undefined;
    }
    if (localAudio) {
      localAudio.pause();
      localAudio.removeAttribute("src");
      localAudio.load();
      localAudio = undefined;
    }
    localAudioReady = false;
    updateSongLabel();
    const playerHost = document.createElement("div");
    playerHost.id = "youtube-player";
    youtubeBackground.replaceChildren(playerHost);
    youtubeBackground.hidden = !track?.youtubeVideoId || Boolean(track?.audioUrl);
    if (track?.audioUrl) {
      localAudio = new Audio();
      localAudio.preload = "auto";
      const selectedTrackId = track.id;
      localAudio.addEventListener("ended", () => {
        if (running && currentTrack?.id === selectedTrackId) finishGame(true);
      });
      try {
        const audioReady = new Promise((resolve, reject) => {
          localAudio.addEventListener("canplay", resolve, { once: true });
          localAudio.addEventListener("error", () => {
            reject(new Error(`Could not load local audio: ${track.audioUrl}`));
          }, { once: true });
          localAudio.src = track.audioUrl;
          localAudio.load();
          if (localAudio.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) resolve();
        });
        const chartReady = track.midiUrl
          ? fetch(track.midiUrl).then(async (response) => {
            if (!response.ok) throw new Error(`Could not fetch MIDI chart (${response.status}): ${track.midiUrl}`);
            return parseMidiChart(await response.arrayBuffer());
          })
          : track.chartUrl
            ? fetch(track.chartUrl).then(async (response) => {
              if (!response.ok) throw new Error(`Could not fetch chart (${response.status}): ${track.chartUrl}`);
              return parseCloneHeroChart(await response.text());
            })
            : Promise.resolve(track.charts);
        const [charts] = await Promise.all([chartReady, audioReady]);
        if (getTrack()?.id !== selectedTrackId) return;
        songLibrary = songLibrary.map((entry) => entry.id === selectedTrackId
          ? { ...entry, charts: { ...entry.charts, ...charts } }
          : entry);
        localAudioReady = true;
      } catch (error) {
        if (getTrack()?.id !== selectedTrackId) return;
        updateSongLabel();
        songLibraryStatus.textContent = `Local song not ready: ${error.message}`;
        songLibraryStatus.hidden = false;
        return;
      }
      updateSongLabel();
      return;
    }
    if (!track?.youtubeVideoId) {
      updateSongLabel();
      return;
    }
    try {
      const YT = await loadYouTubeApi();
      if (getTrack()?.id !== track.id) return;
      youtubePlayer = new YT.Player(playerHost, {
        width: "100%",
        height: "100%",
        videoId: track.youtubeVideoId,
        playerVars: { controls: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            if (getTrack()?.id !== track.id) return;
            youtubePlayerReady = true;
            updateSongLabel();
          },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              youtubeClockAnchorMs = youtubePlayer.getCurrentTime() * 1000;
              youtubeClockAnchorPerformance = performance.now();
              youtubeClockRunning = true;
            } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.BUFFERING) {
              youtubeClockAnchorMs = youtubePlayer.getCurrentTime() * 1000;
              youtubeClockAnchorPerformance = performance.now();
              youtubeClockRunning = false;
            }
            if (event.data === YT.PlayerState.PLAYING && youtubeStartResolve) {
              youtubeStartResolve();
              youtubeStartResolve = undefined;
              youtubeStartReject = undefined;
            }
            if (event.data === YT.PlayerState.ENDED && running) finishGame(true);
          },
          onError: (event) => {
            youtubePlayerReady = false;
            let message;
            if (event.data === 153 && window.location.protocol === "file:") {
              message = "YouTube error 153: open GG2 from http://localhost, not as a file, so the player receives a referrer.";
            } else if (event.data === 101 || event.data === 150) {
              message = "This video cannot be embedded. Choose a YouTube video that allows embedding.";
            } else {
              message = `YouTube player error (${event.data}); check the video URL.`;
            }
            youtubeStartReject?.(new Error(message));
            youtubeStartResolve = undefined;
            youtubeStartReject = undefined;
            updateSongLabel();
            songLibraryStatus.textContent = message;
            songLibraryStatus.hidden = false;
          },
        },
      });
    } catch (error) {
      updateSongLabel();
      songLibraryStatus.textContent = error.message;
      songLibraryStatus.hidden = false;
    }
  }

  function applySongLibrary(text) {
    const loadedLibrary = validateSongLibrary(JSON.parse(text));
    if (!loadedLibrary.some((track) => track.type === "practice")) {
      throw new Error("The song list must include one entry with type set to practice.");
    }
    songLibrary = loadedLibrary;
    const previousId = songSelect.value;
    songSelect.replaceChildren(...songLibrary.map((track) => {
      const option = document.createElement("option");
      option.value = track.id;
      option.textContent = track.artist ? `${track.title} — ${track.artist}` : track.title;
      return option;
    }));
    songSelect.value = getTrack(previousId) ? previousId : "practice";
    songLibraryStatus.textContent = "";
    songLibraryStatus.hidden = true;
    updateSongLabel();
    void prepareYouTubeTrack(currentTrack);
  }

  function parseCloneHeroChart(text) {
    const sections = new Map();
    for (const match of text.matchAll(/\[([^\]]+)\]\s*\{([\s\S]*?)\}/g)) {
      sections.set(match[1].trim().toLowerCase(), match[2]);
    }
    const songSection = sections.get("song") ?? "";
    const resolution = Number(songSection.match(/^\s*Resolution\s*=\s*(\d+)/mi)?.[1] ?? 192);
    if (!Number.isFinite(resolution) || resolution <= 0) {
      throw new Error("Clone Hero chart has an invalid Resolution value.");
    }
    const offsetSeconds = Number(songSection.match(/^\s*Offset\s*=\s*(-?\d+(?:\.\d+)?)/mi)?.[1] ?? 0);
    const tempoEvents = [];
    const syncTrack = sections.get("synctrack") ?? "";
    for (const match of syncTrack.matchAll(/^\s*(\d+)\s*=\s*B\s+(\d+)\s*$/gmi)) {
      const bpm = Number(match[2]) / 1000;
      if (bpm <= 0) throw new Error("Clone Hero chart has an invalid tempo event.");
      tempoEvents.push({ tick: Number(match[1]), bpm });
    }
    tempoEvents.sort((left, right) => left.tick - right.tick);
    const tempos = [];
    for (const tempo of tempoEvents) {
      if (tempos.at(-1)?.tick === tempo.tick) tempos[tempos.length - 1] = tempo;
      else tempos.push(tempo);
    }
    if (tempos[0]?.tick !== 0) tempos.unshift({ tick: 0, bpm: 120 });
    if (tempos.length === 0) tempos.push({ tick: 0, bpm: 120 });

    function tickToMs(tick) {
      let elapsed = 0;
      let activeTick = 0;
      let bpm = tempos[0].bpm;
      for (const tempo of tempos.slice(1)) {
        if (tempo.tick > tick) break;
        elapsed += ((tempo.tick - activeTick) / resolution) * (60000 / bpm);
        activeTick = tempo.tick;
        bpm = tempo.bpm;
      }
      elapsed += ((tick - activeTick) / resolution) * (60000 / bpm);
      return Math.round(elapsed + offsetSeconds * 1000);
    }

    const chartSections = {
      easy: ["easysingle"],
      medium: ["mediumsingle"],
      hard: ["expertsingle", "hardsingle"],
    };
    const charts = {};
    for (const [difficulty, trackNames] of Object.entries(chartSections)) {
      const sectionName = trackNames.find((name) => sections.has(name));
      if (!sectionName) {
        charts[difficulty] = [];
        continue;
      }
      const notesByTime = new Map();
      const body = sections.get(sectionName);
      for (const match of body.matchAll(/^\s*(\d+)\s*=\s*N\s+(\d+)\s+(\d+)\s*$/gmi)) {
        const tick = Number(match[1]);
        const lane = Number(match[2]);
        if (lane < 0 || lane >= laneCount) continue;
        const timeMs = tickToMs(tick);
        if (timeMs < 0) continue;
        if (!notesByTime.has(timeMs)) notesByTime.set(timeMs, new Set());
        notesByTime.get(timeMs).add(lane);
      }
      charts[difficulty] = [...notesByTime.entries()]
        .sort(([left], [right]) => left - right)
        .map(([timeMs, lanes]) => ({ timeMs, lanes: [...lanes].sort((a, b) => a - b) }));
    }
    if (!Object.values(charts).some((notes) => notes.length > 0)) {
      throw new Error("No five-fret EasySingle, MediumSingle, HardSingle, or ExpertSingle notes found.");
    }
    return charts;
  }

  function parseMidiChart(buffer) {
    const data = new DataView(buffer);
    let cursor = 0;
    const textDecoder = new TextDecoder();
    const readText = (start, length) => textDecoder.decode(new Uint8Array(buffer, start, length));
    const readUint32 = (offset) => data.getUint32(offset, false);
    const readVariableLength = (state) => {
      let value = 0;
      for (let count = 0; count < 4; count += 1) {
        if (state.position >= state.end) throw new Error("MIDI file ended inside a variable-length value.");
        const byte = data.getUint8(state.position++);
        value = (value << 7) | (byte & 0x7f);
        if ((byte & 0x80) === 0) return value;
      }
      throw new Error("MIDI file contains an invalid variable-length value.");
    };

    if (data.byteLength < 14 || readText(0, 4) !== "MThd") {
      throw new Error("This is not a valid Standard MIDI file.");
    }
    const headerLength = readUint32(4);
    const format = data.getUint16(8, false);
    const trackCount = data.getUint16(10, false);
    const resolution = data.getUint16(12, false);
    if (headerLength < 6 || format > 1 || resolution === 0 || (resolution & 0x8000) !== 0) {
      throw new Error("Only PPQN format 0 or 1 MIDI charts are supported.");
    }
    cursor = 8 + headerLength;
    const tempos = [];
    const tracks = [];
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
      if (cursor + 8 > data.byteLength || readText(cursor, 4) !== "MTrk") {
        throw new Error(`MIDI track ${trackIndex + 1} has an invalid header.`);
      }
      const length = readUint32(cursor + 4);
      const state = { position: cursor + 8, end: cursor + 8 + length };
      if (state.end > data.byteLength) throw new Error(`MIDI track ${trackIndex + 1} is truncated.`);
      cursor = state.end;
      let tick = 0;
      let runningStatus = 0;
      let name = "";
      const notes = [];
      while (state.position < state.end) {
        tick += readVariableLength(state);
        let status = data.getUint8(state.position++);
        if (status < 0x80) {
          if (runningStatus < 0x80 || runningStatus >= 0xf0) {
            throw new Error(`MIDI track ${trackIndex + 1} has invalid running status.`);
          }
          state.position -= 1;
          status = runningStatus;
        } else if (status < 0xf0) {
          runningStatus = status;
        }

        if (status === 0xff) {
          const metaType = data.getUint8(state.position++);
          const metaLength = readVariableLength(state);
          const metaStart = state.position;
          const metaEnd = metaStart + metaLength;
          if (metaEnd > state.end) throw new Error(`MIDI track ${trackIndex + 1} has truncated metadata.`);
          if (metaType === 0x03) name = readText(metaStart, metaLength);
          if (metaType === 0x51 && metaLength === 3) {
            const microsecondsPerQuarter = (data.getUint8(metaStart) << 16)
              | (data.getUint8(metaStart + 1) << 8)
              | data.getUint8(metaStart + 2);
            if (microsecondsPerQuarter > 0) tempos.push({ tick, microsecondsPerQuarter });
          }
          state.position = metaEnd;
          runningStatus = 0;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) {
          const sysexLength = readVariableLength(state);
          state.position += sysexLength;
          if (state.position > state.end) throw new Error(`MIDI track ${trackIndex + 1} has truncated system-exclusive data.`);
          runningStatus = 0;
          continue;
        }

        const command = status & 0xf0;
        const dataLength = command === 0xc0 || command === 0xd0 ? 1 : 2;
        if (state.position + dataLength > state.end) {
          throw new Error(`MIDI track ${trackIndex + 1} has truncated channel data.`);
        }
        const first = data.getUint8(state.position++);
        const second = dataLength === 1
          ? 0
          : data.getUint8(state.position++);
        if (command === 0x90 && second > 0) {
          notes.push({ tick, pitch: first });
        }
      }
      tracks.push({ name, notes });
    }

    const guitarTrack = tracks.find((track) => track.name.trim().toUpperCase() === "PART GUITAR");
    if (!guitarTrack) throw new Error('MIDI file does not have a "PART GUITAR" track.');
    tempos.sort((left, right) => left.tick - right.tick);
    const tempoMap = [];
    for (const tempo of tempos) {
      if (tempoMap.at(-1)?.tick === tempo.tick) tempoMap[tempoMap.length - 1] = tempo;
      else tempoMap.push(tempo);
    }
    if (tempoMap[0]?.tick !== 0) tempoMap.unshift({ tick: 0, microsecondsPerQuarter: 500000 });
    const tickToMs = (targetTick) => {
      let elapsed = 0;
      let previousTick = 0;
      let tempo = tempoMap[0].microsecondsPerQuarter;
      for (const event of tempoMap.slice(1)) {
        if (event.tick > targetTick) break;
        elapsed += ((event.tick - previousTick) / resolution) * tempo / 1000;
        previousTick = event.tick;
        tempo = event.microsecondsPerQuarter;
      }
      return Math.round(elapsed + ((targetTick - previousTick) / resolution) * tempo / 1000);
    };
    const pitchGroups = { easy: 0, medium: 1, hard: 2 };
    const charts = Object.fromEntries(Object.keys(settings).map((difficulty) => [difficulty, []]));
    for (const [difficulty, group] of Object.entries(pitchGroups)) {
      const notesByTime = new Map();
      for (const note of guitarTrack.notes) {
        const lane = note.pitch - 60 - group * 12;
        if (lane < 0 || lane >= laneCount) continue;
        const timeMs = tickToMs(note.tick);
        if (!notesByTime.has(timeMs)) notesByTime.set(timeMs, new Set());
        notesByTime.get(timeMs).add(lane);
      }
      charts[difficulty] = [...notesByTime.entries()]
        .sort(([left], [right]) => left - right)
        .map(([timeMs, lanes]) => ({ timeMs, lanes: [...lanes].sort((a, b) => a - b) }));
    }
    if (!Object.values(charts).some((notes) => notes.length > 0)) {
      throw new Error("No five-lane Easy, Medium, or Hard notes found in PART GUITAR.");
    }
    return charts;
  }

  function loadSongLibraryFromServer() {
    if (window.location.protocol === "file:") return;
    fetch("songs.json").then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    }).then((text) => {
      applySongLibrary(text);
    }).catch((error) => {
      songLibraryStatus.textContent = `Song list not loaded: ${error.message}`;
      songLibraryStatus.hidden = false;
    });
  }

  function makeChart(difficulty) {
    const density = settings[difficulty].density;
    const notes = [];
    for (let beat = 0; beat < 64; beat += 1) {
      if (beat % 4 !== 0 && ((beat * 7) % 10) / 10 > density) continue;
      notes.push({
        time: beat * beatMs,
        lanes: beatPattern[beat % beatPattern.length],
        hit: false,
        missed: false,
      });
      if (difficulty === "hard" && beat % 4 === 2) {
        notes.push({
          time: beat * beatMs + beatMs / 2,
          lanes: [beat % laneCount],
          hit: false,
          missed: false,
        });
      }
    }
    return notes;
  }

  function showFeedback(text, missed = false) {
    feedbackElement.textContent = text;
    feedbackElement.classList.toggle("is-missed", missed);
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => {
      feedbackElement.textContent = "";
    }, 420);
  }

  function updateHud() {
    const multiplier = Math.min(4, 1 + Math.floor(combo / 10));
    scoreElement.textContent = score.toLocaleString();
    comboElement.textContent = String(combo);
    multiplierElement.textContent = `${multiplier}×`;
    rockFill.style.width = `${rock}%`;
    rockMeter.setAttribute("aria-valuenow", String(Math.round(rock)));
  }

  function drawBackground(now) {
    const width = canvas.width;
    const height = canvas.height;
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#19151b");
    sky.addColorStop(0.58, "#42262b");
    sky.addColorStop(1, "#100e13");
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    for (let light = 0; light < 4; light += 1) {
      const x = 95 + light * 255;
      const sway = Math.sin(now / 1300 + light * 2) * 55;
      const glow = context.createRadialGradient(x + sway, 78, 4, x + sway, 220, 250);
      glow.addColorStop(0, "rgb(255, 188, 107, 0.22)");
      glow.addColorStop(1, "rgb(255, 87, 67, 0)");
      context.fillStyle = glow;
      context.fillRect(x - 250 + sway, 0, 500, 450);
      context.fillStyle = "rgb(255, 232, 179, 0.45)";
      context.beginPath();
      context.arc(x + sway, 30, 5, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "#100e13";
    context.beginPath();
    context.moveTo(0, 404);
    for (let x = 0; x <= width; x += 32) {
      const headY = 399 + Math.sin(x * 0.05) * 9;
      context.lineTo(x, headY);
      context.lineTo(x + 13, headY - 5);
      context.lineTo(x + 22, headY + 10);
    }
    context.lineTo(width, height);
    context.lineTo(0, height);
    context.closePath();
    context.fill();

    context.fillStyle = "rgb(255, 179, 102, 0.5)";
    for (let i = 0; i < 50; i += 1) {
      const x = (i * 197 + Math.floor(now / 45) * (i % 3 + 1)) % width;
      const y = 340 + ((i * 73) % 95);
      context.fillRect(x, y, 2, 2);
    }
  }

  function projectDepth(depth) {
    const progress = Math.max(0, Math.min(1, depth));
    return highwayHorizonY + (hitLineY - highwayHorizonY) * progress ** 1.38;
  }

  function laneGeometry(lane, depth) {
    const screenProgress = (projectDepth(depth) - highwayHorizonY) / (hitLineY - highwayHorizonY);
    const halfWidth = highwayTopHalfWidth
      + screenProgress * (highwayBottomHalfWidth - highwayTopHalfWidth);
    const laneWidth = (halfWidth * 2) / laneCount;
    return {
      laneWidth,
      x: canvas.width / 2 + (lane - 2) * laneWidth,
    };
  }

  function drawHighway() {
    const horizon = highwayHorizonY;
    const hitY = hitLineY;
    const topHalf = highwayTopHalfWidth;
    const bottomHalf = highwayBottomHalfWidth;
    context.fillStyle = "rgb(12, 12, 17, 0.62)";
    context.beginPath();
    context.moveTo(canvas.width / 2 - topHalf, horizon);
    context.lineTo(canvas.width / 2 + topHalf, horizon);
    context.lineTo(canvas.width / 2 + bottomHalf, hitY + 34);
    context.lineTo(canvas.width / 2 - bottomHalf, hitY + 34);
    context.closePath();
    context.fill();

    context.save();
    context.beginPath();
    context.moveTo(canvas.width / 2 - topHalf, horizon);
    context.lineTo(canvas.width / 2 + topHalf, horizon);
    context.lineTo(canvas.width / 2 + bottomHalf, hitY + 34);
    context.lineTo(canvas.width / 2 - bottomHalf, hitY + 34);
    context.closePath();
    context.clip();

    for (let lane = 0; lane < laneCount; lane += 1) {
      const topX = canvas.width / 2 + (lane - 2) * (topHalf * 2 / laneCount);
      const bottomX = canvas.width / 2 + (lane - 2) * (bottomHalf * 2 / laneCount);
      context.fillStyle = lane % 2 === 0 ? "rgb(255, 255, 255, 0.035)" : "rgb(0, 0, 0, 0.13)";
      context.beginPath();
      context.moveTo(topX - topHalf / laneCount, horizon);
      context.lineTo(topX + topHalf / laneCount, horizon);
      context.lineTo(bottomX + bottomHalf / laneCount, hitY + 34);
      context.lineTo(bottomX - bottomHalf / laneCount, hitY + 34);
      context.fill();
      context.strokeStyle = "rgb(213, 192, 174, 0.23)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(topX, horizon);
      context.lineTo(bottomX, hitY + 34);
      context.stroke();
    }
    context.restore();

    context.strokeStyle = "rgb(238, 203, 164, 0.66)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(canvas.width / 2 - topHalf, horizon);
    context.lineTo(canvas.width / 2 - bottomHalf, hitY + 34);
    context.moveTo(canvas.width / 2 + topHalf, horizon);
    context.lineTo(canvas.width / 2 + bottomHalf, hitY + 34);
    context.stroke();

    context.strokeStyle = "rgb(255, 244, 208, 0.94)";
    context.shadowColor = "#f3a64b";
    context.shadowBlur = 12;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(canvas.width / 2 - bottomHalf, hitY);
    context.lineTo(canvas.width / 2 + bottomHalf, hitY);
    context.stroke();
    context.shadowBlur = 0;

    for (let lane = 0; lane < laneCount; lane += 1) {
      const { x, laneWidth } = laneGeometry(lane, 1);
      const held = activeLanes.has(lane);
      const hitFlash = Math.max(0, laneHitUntil[lane] - performance.now());
      const hitScale = hitFlash > 0 ? 1 + (hitFlash / 170) * 0.24 : 1;
      context.fillStyle = "#17141a";
      context.beginPath();
      context.arc(x, hitY + 4, laneWidth * 0.3 * hitScale, 0, Math.PI * 2);
      context.fill();
      context.shadowColor = laneColors[lane];
      context.shadowBlur = held || hitFlash > 0 ? 30 : 9;
      context.fillStyle = held ? "#fff3d4" : laneColors[lane];
      context.beginPath();
      context.arc(x, hitY + 4, laneWidth * (held ? 0.2 : 0.17) * hitScale, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = laneColors[lane];
      context.lineWidth = 4;
      context.beginPath();
      context.arc(x, hitY + 4, laneWidth * 0.23, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawNote(note, elapsed) {
    if (note.hit || note.missed) return;
    const depth = (elapsed - note.time + approachMs) / approachMs;
    const halfNoteDepth = noteLengthMs / (2 * approachMs);
    const backDepth = Math.max(0, depth - halfNoteDepth);
    const frontDepth = Math.min(1.08, depth + halfNoteDepth);
    if (frontDepth <= 0 || backDepth > 1) return;
    const topY = projectDepth(backDepth);
    const bottomY = projectDepth(frontDepth);
    const noteHeight = Math.max(8, bottomY - topY);
    const middleDepth = Math.max(0, Math.min(1, depth));
    const centerY = projectDepth(middleDepth);

    context.save();
    context.beginPath();
    context.moveTo(canvas.width / 2 - highwayTopHalfWidth, highwayHorizonY);
    context.lineTo(canvas.width / 2 + highwayTopHalfWidth, highwayHorizonY);
    context.lineTo(canvas.width / 2 + highwayBottomHalfWidth, hitLineY + 34);
    context.lineTo(canvas.width / 2 - highwayBottomHalfWidth, hitLineY + 34);
    context.closePath();
    context.clip();

    for (const lane of note.lanes) {
      const { x, laneWidth: currentLaneWidth } = laneGeometry(lane, middleDepth);
      const noteWidth = currentLaneWidth * 0.78;
      const cornerRadius = Math.min(noteHeight * 0.34, noteWidth * 0.2);
      const noteTop = centerY - noteHeight / 2;
      const gradient = context.createLinearGradient(0, noteTop, 0, noteTop + noteHeight);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.96)");
      gradient.addColorStop(0.22, laneColors[lane]);
      gradient.addColorStop(0.78, laneColors[lane]);
      gradient.addColorStop(1, "rgba(12, 10, 14, 0.82)");

      context.shadowColor = laneColors[lane];
      context.shadowBlur = 5 + middleDepth * 9;
      context.fillStyle = "#100e13";
      context.beginPath();
      context.roundRect(
        x - noteWidth / 2,
        noteTop,
        noteWidth,
        noteHeight,
        cornerRadius,
      );
      context.fill();
      context.shadowBlur = 0;
      context.fillStyle = gradient;
      context.beginPath();
      context.roundRect(
        x - noteWidth / 2 + 2,
        noteTop + 2,
        noteWidth - 4,
        Math.max(4, noteHeight - 4),
        Math.max(2, cornerRadius - 2),
      );
      context.fill();
      context.strokeStyle = "rgba(255, 249, 232, 0.9)";
      context.lineWidth = 1.5;
      context.beginPath();
      context.roundRect(
        x - noteWidth / 2,
        noteTop,
        noteWidth,
        noteHeight,
        cornerRadius,
      );
      context.stroke();
      context.fillStyle = "rgba(255, 255, 255, 0.48)";
      context.beginPath();
      context.roundRect(
        x - noteWidth * 0.2,
        noteTop + noteHeight * 0.25,
        noteWidth * 0.4,
        Math.max(2, noteHeight * 0.12),
        3,
      );
      context.fill();
    }
    context.restore();
  }

  function draw(elapsed, now) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!currentTrack?.youtubeVideoId) drawBackground(now);
    drawHighway();
    for (const note of chart) drawNote(note, elapsed);
  }

  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const length = Math.ceil(audioContext.sampleRate * 0.2);
    noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function playKick(time) {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(125, time);
    oscillator.frequency.exponentialRampToValueAtTime(44, time + 0.12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.42, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.17);
  }

  function playSnare(time) {
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const noiseGain = audioContext.createGain();
    const body = audioContext.createOscillator();
    const bodyGain = audioContext.createGain();

    source.buffer = getNoiseBuffer();
    filter.type = "highpass";
    filter.frequency.value = 1400;
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.16, time + 0.003);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    source.start(time);
    source.stop(time + 0.14);

    body.type = "triangle";
    body.frequency.setValueAtTime(185, time);
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.12, time + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
    body.connect(bodyGain);
    bodyGain.connect(audioContext.destination);
    body.start(time);
    body.stop(time + 0.1);
  }

  function playHiHat(time, accent) {
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = getNoiseBuffer();
    filter.type = "highpass";
    filter.frequency.value = 7600;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.055 : 0.026, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start(time);
    source.stop(time + 0.05);
  }

  function playBass(time, beat) {
    const bassPattern = [0, 0, 3, 5, 0, 0, 7, 5];
    const frequency = 55 * (2 ** (bassPattern[beat % bassPattern.length] / 12));
    const oscillator = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(620, time);
    filter.frequency.exponentialRampToValueAtTime(190, time + 0.22);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.075, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.26);
  }

  function scheduleOriginalBacking() {
    const finalChartTime = chart.at(-1)?.time ?? 0;
    const beatCount = Math.ceil(finalChartTime / beatMs) + 1;
    for (let beat = 0; beat < beatCount; beat += 1) {
      const time = songStartAudioTime + beat * beatSeconds;
      playBass(time, beat);
      if (beat % 4 === 0) playKick(time);
      if (beat % 4 === 2) playSnare(time);
      playHiHat(time, beat % 4 === 0 || beat % 4 === 2);
      playHiHat(time + beatSeconds / 2, false);
    }
  }

  function playHitGuitar(lane) {
    if (!audioContext || soundSetting.value === "off") return;
    const time = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const overtone = audioContext.createOscillator();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();

    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(laneFrequencies[lane], time);
    overtone.type = "triangle";
    overtone.frequency.setValueAtTime(laneFrequencies[lane] * 2.01, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2400, time);
    filter.frequency.exponentialRampToValueAtTime(500, time + 0.19);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.12, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.23);
    oscillator.connect(filter);
    overtone.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(time);
    overtone.start(time);
    oscillator.stop(time + 0.24);
    overtone.stop(time + 0.24);
  }

  function playMissScratch() {
    if (!audioContext || soundSetting.value === "off") return;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    const time = audioContext.currentTime;
    source.buffer = getNoiseBuffer();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2100, time);
    filter.frequency.exponentialRampToValueAtTime(550, time + 0.12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.065, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    source.start(time);
    source.stop(time + 0.14);
  }

  function playBackingTrack() {
    if (!audioContext || soundSetting.value === "off") return;
    if (currentTrack?.youtubeVideoId || currentTrack?.audioUrl) return;
    scheduleOriginalBacking();
  }

  function stopAudio() {
    clearTimeout(youtubePreRollTimer);
    clearTimeout(localAudioPreRollTimer);
    youtubePreRoll = false;
    localAudioPreRoll = false;
    if (youtubePlayerReady && youtubePlayer) youtubePlayer.pauseVideo();
    if (localAudio) localAudio.pause();
    if (!audioContext) return;
    audioContext.close();
    audioContext = undefined;
  }

  function showScreen(screen) {
    currentScreen = screen;
    mainMenu.hidden = screen !== "menu";
    setupScreen.hidden = screen !== "setup";
    optionsScreen.hidden = screen !== "options";
    menuOverlay.hidden = false;
    resultsOverlay.hidden = true;
  }

  function openSetup(mode) {
    currentMode = mode;
    showScreen("setup");
    difficultyControl.hidden = mode === "training";

    if (mode === "career") {
      setupTitle.textContent = "Career";
      setupDescription.textContent = "Start your run from the local stage and work your way up.";
      setupNote.textContent = `Gig ${careerStage} of 3 · Clear a set to unlock the next stage.`;
      startButton.textContent = `Start gig ${careerStage}`;
      difficultySelect.value = ["easy", "medium", "hard"][careerStage - 1];
    } else if (mode === "multiplayer") {
      setupTitle.textContent = "Local Multiplayer";
      setupDescription.textContent = "Pass the keyboard between two players and compare your set scores.";
      setupNote.textContent = "Player 1 plays first. Player 2 gets the same chart and difficulty.";
      startButton.textContent = "Start player 1";
      difficultySelect.value = selectedDifficulty;
    } else if (mode === "training") {
      setupTitle.textContent = "Training";
      setupDescription.textContent = "Practice the riff on Easy. Misses won't end your session.";
      setupNote.textContent = "Song titles are setlist labels; this plays the original practice riff.";
      startButton.textContent = "Start training";
      difficultySelect.value = "easy";
    } else {
      setupTitle.textContent = "Quick Play";
      setupDescription.textContent = "Pick a difficulty and jump straight into the practice riff.";
      setupNote.textContent = "One original practice chart. Go for your high score.";
      startButton.textContent = "Start set";
      difficultySelect.value = selectedDifficulty;
    }
    updateSongLabel();
  }

  function activateMenuAction(action) {
    if (action === "options") {
      defaultDifficulty.value = selectedDifficulty;
      showScreen("options");
    } else if (action === "back") {
      showScreen("menu");
    } else if (["career", "quickplay", "multiplayer", "training"].includes(action)) {
      openSetup(action);
    }
  }

  function selectMenu(index) {
    selectedMenuIndex = (index + menuButtons.length) % menuButtons.length;
    menuButtons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === selectedMenuIndex;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-current", selected ? "true" : "false");
    });
  }

  async function startGame() {
    const track = getTrack();
    if (!track) {
      songLibraryStatus.textContent = "Select a song from the loaded song list.";
      songLibraryStatus.hidden = false;
      return;
    }
    stopAudio();
    clearTimeout(inputTimeout);
    noiseBuffer = undefined;
    score = 0;
    combo = 0;
    bestCombo = 0;
    rock = 50;
    activeLanes.clear();
    keyboardLanes.clear();
    gamepadLanes.clear();
    pointerLanes.clear();
    previousGamepadLanes.clear();
    pendingInputLanes.clear();
    for (const button of fretButtons) {
      button.classList.remove("is-held");
      button.setAttribute("aria-pressed", "false");
    }
    if (currentMode === "career") {
      difficultySelect.value = ["easy", "medium", "hard"][careerStage - 1];
    } else if (currentMode === "training") {
      difficultySelect.value = "easy";
    }
    selectedDifficulty = difficultySelect.value;
    updateSongLabel();
    chart = getTrackChart(track, selectedDifficulty) ?? [];
    if (track.type !== "practice"
      && (chart.length === 0
        || (track.audioUrl ? !localAudioReady : !track.youtubeVideoId || !youtubePlayerReady))) {
      updateSongLabel();
      return;
    }
    updateHud();
    let localPlaying;
    if (track.audioUrl) {
      localAudioPreRoll = true;
      localAudio.currentTime = 0;
      localAudio.muted = true;
      songStartPerformanceTime = performance.now() + approachMs;
      localPlaying = localAudio.play();
    }
    let youtubePlaying;
    if (track.youtubeVideoId) {
      youtubePreRoll = true;
      clockStatus.textContent = "Starting YouTube video…";
      youtubePlayer.mute();
      youtubePlayer.seekTo(0, true);
      youtubePlaying = new Promise((resolve, reject) => {
        youtubeStartResolve = resolve;
        youtubeStartReject = reject;
        setTimeout(() => {
          if (youtubeStartResolve) {
            youtubeStartResolve = undefined;
            youtubeStartReject = undefined;
            reject(new Error("YouTube did not start. Check whether the video allows embedding."));
          }
        }, 10000);
      });
      youtubePlayer.playVideo();
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      try {
        await audioContext.resume();
      } catch (error) {
        clockStatus.textContent = `Audio sync unavailable (${error.message}); using browser clock`;
        await audioContext.close();
        audioContext = undefined;
      }
    } else {
      clockStatus.textContent = "Audio sync unavailable; using browser clock";
    }

    if (track.audioUrl) {
      try {
        await localPlaying;
      } catch (error) {
        localAudioPreRoll = false;
        stopAudio();
        updateSongLabel();
        songLibraryStatus.textContent = `Local audio could not start: ${error.message}`;
        songLibraryStatus.hidden = false;
        return;
      }
    }
    if (audioContext) {
      songStartAudioTime = audioContext.currentTime + approachSeconds;
    } else {
      clockStatus.textContent = "Audio sync unavailable; using browser clock";
    }
    if (track.audioUrl) {
      songStartPerformanceTime = performance.now() + approachMs;
      localAudioPreRollTimer = setTimeout(() => {
        if (!running || currentTrack?.id !== track.id || !localAudio) return;
        localAudio.currentTime = 0;
        localAudio.muted = soundSetting.value === "off";
        localAudioPreRoll = false;
        clockStatus.textContent = "Local audio-clock synced";
      }, approachMs);
    } else if (track.youtubeVideoId) {
      try {
        await youtubePlaying;
      } catch (error) {
        stopAudio();
        updateSongLabel();
        songLibraryStatus.textContent = error.message;
        songLibraryStatus.hidden = false;
        return;
      }
      songStartPerformanceTime = performance.now() + approachMs;
      youtubePreRollTimer = setTimeout(() => {
        if (!running || !youtubePlayerReady || currentTrack?.id !== track.id) return;
        youtubePlayer.seekTo(0, true);
        youtubeClockAnchorMs = 0;
        youtubeClockAnchorPerformance = performance.now();
        youtubeClockRunning = true;
        if (soundSetting.value === "on") youtubePlayer.unMute();
        youtubePreRoll = false;
        clockStatus.textContent = "YouTube audio-clock synced";
      }, approachMs);
    } else {
      songStartPerformanceTime = performance.now() + approachMs;
      clockStatus.textContent = audioContext ? "Audio-clock synced" : "Browser-clock timing";
    }
    menuOverlay.hidden = true;
    resultsOverlay.hidden = true;
    running = true;
    playBackingTrack();
    animationFrame = requestAnimationFrame(frame);
  }

  function showResults(title, message, actionLabel, kicker) {
    running = false;
    cancelAnimationFrame(animationFrame);
    stopAudio();
    resultsTitle.textContent = title;
    resultsMessage.textContent = message;
    resultsKicker.textContent = kicker;
    resultAction.textContent = actionLabel;
    resultsOverlay.hidden = false;
    menuOverlay.hidden = true;
    showFeedback("");
  }

  function finishGame(success) {
    if (currentMode === "multiplayer" && currentPlayer === 1) {
      multiplayerScores[0] = score;
      showResults(
        "Pass the guitar",
        `Player 1 scored ${score.toLocaleString()}. Hand the controls to Player 2 for the same chart.`,
        "Start player 2",
        "GG2 · LOCAL DUEL",
      );
      return;
    }

    if (currentMode === "multiplayer") {
      multiplayerScores[1] = score;
      const [playerOne, playerTwo] = multiplayerScores;
      const outcome = playerOne === playerTwo
        ? "It's a tie!"
        : playerOne > playerTwo ? "Player 1 takes the win!" : "Player 2 takes the win!";
      showResults(
        outcome,
        `Player 1: ${playerOne.toLocaleString()} · Player 2: ${playerTwo.toLocaleString()}`,
        "Play again",
        "GG2 · DUEL RESULTS",
      );
      return;
    }

    if (currentMode === "career" && success && careerStage < 3) {
      showResults(
        `Gig ${careerStage} complete!`,
        `You scored ${score.toLocaleString()}. One more stage is ready when you are.`,
        "Next gig",
        "GG2 · CAREER TOUR",
      );
      return;
    }

    if (currentMode === "career" && success) {
      showResults(
        "Tour complete!",
        `You cleared all three gigs with a final score of ${score.toLocaleString()}.`,
        "Play career again",
        "GG2 · CAREER TOUR",
      );
      return;
    }

    if (currentMode === "career") {
      showResults("Gig over", `Score ${score.toLocaleString()} · Best streak ${bestCombo}. Try the gig again.`, "Retry gig", "GG2 · CAREER TOUR");
      return;
    }

    const title = success ? "Set complete!" : "The crowd went quiet!";
    const message = `Score ${score.toLocaleString()} · Best streak ${bestCombo} · ${Math.round(rock)}% rock meter`;
    const action = currentMode === "training" ? "Train again" : "Play again";
    showResults(title, message, action, currentMode === "training" ? "GG2 · PRACTICE" : "GG2 · SET RESULTS");
  }

  function advanceResults() {
    resultsOverlay.hidden = true;
    if (currentMode === "multiplayer" && currentPlayer === 1) {
      currentPlayer = 2;
      startGame();
    } else if (currentMode === "career" && careerStage < 3) {
      careerStage += 1;
      startGame();
    } else if (currentMode === "career") {
      careerStage = 1;
      openSetup("career");
    } else {
      startGame();
    }
  }

  function frame(now) {
    if (!running) return;
    pollGamepads();
    const elapsed = songTimeMs();
    for (const note of chart) {
      const inputPendingForNote = pendingInputLanes.size > 0
        && Math.abs(note.time - pendingInputAt) <= settings[selectedDifficulty].hitWindow;
      if (!note.hit && !note.missed && !inputPendingForNote
        && elapsed > note.time + settings[selectedDifficulty].hitWindow) {
        note.missed = true;
        combo = 0;
        if (currentMode !== "training") rock = Math.max(0, rock - 5);
          playMissScratch();
      }
    }
    updateHud();
    draw(elapsed, now);

    if (currentMode !== "training" && rock <= 0) {
      finishGame(false);
      return;
    }
    if (!currentTrack?.audioUrl && elapsed > chart[chart.length - 1].time + 1800) {
      finishGame(true);
      return;
    }
    animationFrame = requestAnimationFrame(frame);
  }

  function updateActiveFrets() {
    activeLanes.clear();
    for (const lane of keyboardLanes) activeLanes.add(lane);
    for (const lane of gamepadLanes) activeLanes.add(lane);
    for (const lane of pointerLanes) activeLanes.add(lane);
    for (let lane = 0; lane < laneCount; lane += 1) {
      const button = fretButtonByLane.get(lane);
      const held = activeLanes.has(lane);
      button.classList.toggle("is-held", held);
      button.setAttribute("aria-pressed", String(held));
    }
  }

  function setKeyboardFret(lane, held) {
    if (held) keyboardLanes.add(lane);
    else keyboardLanes.delete(lane);
    updateActiveFrets();
  }

  function queueFretInput(lane, pressedAt = songTimeMs()) {
    if (pendingInputLanes.size === 0) pendingInputAt = pressedAt;
    pendingInputLanes.add(lane);
    clearTimeout(inputTimeout);
    inputTimeout = setTimeout(() => {
      const pressedLanes = new Set(pendingInputLanes);
      pendingInputLanes.clear();
      judgeFrets(pressedLanes, pendingInputAt);
    }, 24);
  }

  function pollGamepads() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pressedLanes = new Set();
    let connected = false;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      connected = true;
      for (let lane = 0; lane < gamepadButtons.length; lane += 1) {
        const button = pad.buttons[gamepadButtons[lane]];
        if (button && (button.pressed || button.value > 0.5)) pressedLanes.add(lane);
      }
    }

    gamepadLanes.clear();
    for (const lane of pressedLanes) gamepadLanes.add(lane);
    for (const lane of pressedLanes) {
      if (!previousGamepadLanes.has(lane)) queueFretInput(lane);
    }
    previousGamepadLanes.clear();
    for (const lane of pressedLanes) previousGamepadLanes.add(lane);
    updateActiveFrets();
    controllerStatus.textContent = connected ? "Controller connected" : "Keyboard · PS2 USB adapter or standard gamepad";
  }

  function judgeFrets(pressedLanes, pressedAt) {
    if (!running || pressedLanes.size === 0) return;
    let target;
    let smallestDifference = Infinity;

    for (const note of chart) {
      if (note.hit || note.missed) continue;
      const difference = Math.abs(note.time - pressedAt);
      if (difference < smallestDifference) {
        target = note;
        smallestDifference = difference;
      }
      if (note.time - pressedAt > settings[selectedDifficulty].hitWindow) break;
    }

    const hitWindow = settings[selectedDifficulty].hitWindow;
    if (!target || smallestDifference > hitWindow) {
      combo = 0;
      if (currentMode !== "training") rock = Math.max(0, rock - 4);
      playMissScratch();
      showFeedback("MISS", true);
      updateHud();
      return;
    }

    target.hit = true;
    const matchingFrets = target.lanes.length === pressedLanes.size
      && target.lanes.every((lane) => pressedLanes.has(lane));
    if (!matchingFrets) {
      combo = 0;
      if (currentMode !== "training") rock = Math.max(0, rock - 7);
      playMissScratch();
      showFeedback("WRONG FRETS", true);
      updateHud();
      return;
    }

    const multiplier = Math.min(4, 1 + Math.floor(combo / 10));
    combo += 1;
    bestCombo = Math.max(bestCombo, combo);
    const points = smallestDifference <= 55 ? 100 : smallestDifference <= 110 ? 75 : 50;
    score += points * multiplier;
    rock = Math.min(100, rock + 1.6);
    for (const lane of target.lanes) playHitGuitar(lane);
    for (const lane of target.lanes) laneHitUntil[lane] = performance.now() + 170;
    showFeedback(smallestDifference <= 55 ? "PERFECT!" : "GREAT!");
    updateHud();
  }

  for (const button of menuButtons) {
    button.addEventListener("mouseenter", () => selectMenu(menuButtons.indexOf(button)));
    button.addEventListener("click", () => {
      selectMenu(menuButtons.indexOf(button));
      activateMenuAction(button.dataset.action);
    });
  }

  for (const button of backButtons) {
    button.addEventListener("click", () => activateMenuAction("back"));
  }

  startButton.addEventListener("click", () => {
    currentPlayer = 1;
    multiplayerScores = [];
    void startGame();
  });

  songSelect.addEventListener("change", updateSongLabel);
  songSelect.addEventListener("change", () => {
    void prepareYouTubeTrack(getTrack());
  });
  difficultySelect.addEventListener("change", updateSongLabel);

  saveOptionsButton.addEventListener("click", () => {
    selectedDifficulty = defaultDifficulty.value;
    difficultySelect.value = selectedDifficulty;
    showScreen("menu");
  });

  resultAction.addEventListener("click", advanceResults);
  resultMenu.addEventListener("click", () => {
    careerStage = 1;
    currentPlayer = 1;
    showScreen("menu");
  });

  window.addEventListener("keydown", (event) => {
    if (running) {
      const lane = laneKeys.indexOf(event.key.toLowerCase());
      if (lane >= 0 && !event.repeat) {
        event.preventDefault();
        setKeyboardFret(lane, true);
        queueFretInput(lane);
      }
      return;
    }

    if (resultsOverlay.hidden && currentScreen === "menu") {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        selectMenu(selectedMenuIndex + (event.key === "ArrowDown" ? 1 : -1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        activateMenuAction(menuButtons[selectedMenuIndex].dataset.action);
      }
    } else if (event.key === "Escape" && resultsOverlay.hidden && currentScreen !== "menu") {
      event.preventDefault();
      showScreen("menu");
    }
  });

  window.addEventListener("keyup", (event) => {
    const lane = laneKeys.indexOf(event.key.toLowerCase());
    if (lane >= 0) setKeyboardFret(lane, false);
  });

  window.addEventListener("blur", () => {
    keyboardLanes.clear();
    gamepadLanes.clear();
    previousGamepadLanes.clear();
    updateActiveFrets();
  });

  for (const button of fretButtons) {
    const lane = Number(button.dataset.lane);
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      setPointerFret(lane, true);
      queueFretInput(lane);
    });
    const releasePointerFret = () => setPointerFret(lane, false);
    button.addEventListener("pointerup", releasePointerFret);
    button.addEventListener("pointercancel", releasePointerFret);
    button.addEventListener("lostpointercapture", releasePointerFret);
  }

  songLibrary = [...songSelect.options].map((option) => ({
    id: option.value,
    title: option.textContent,
    artist: "",
    type: option.value === "practice" ? "practice" : undefined,
    youtubeVideoId: "",
    charts: {},
  }));
  selectedDifficulty = difficultySelect.value;
  updateSongLabel();
  youtubeBackground.hidden = true;
  selectMenu(0);
  updateHud();
  draw(0, performance.now());
  loadSongLibraryFromServer();
})();
