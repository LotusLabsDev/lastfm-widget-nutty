///////////////
// PARAMETERS //
///////////////

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const apiKey = urlParams.get("apikey") || "";
const username = urlParams.get("username") || "";
const visibilityDuration = Number(urlParams.get("duration") || 0);
const hideAlbumArt = urlParams.has("hideAlbumArt");

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
const POLL_INTERVAL_MS = 3000;

let currentState = false;
let currentTrackId = "";
let currentDurationSeconds = 0;
let trackStartedAtMs = Date.now();
let pollTimeoutId = null;
let widgetVisibility = false;

function BuildConfigureUrl() {
	const path = window.location.pathname
		.replace(/\/index\.html$/, "/")
		.replace(/\/+$/, "/");
	return `${window.location.origin}${path}configure/`;
}

////////////////
// LAST.FM API //
////////////////

async function FetchLastFm(method, params = {}) {
	const allParams = new URLSearchParams({
		method,
		api_key: apiKey,
		format: "json",
		...params
	});

	const response = await fetch(`${LASTFM_API_URL}?${allParams.toString()}`);
	if (!response.ok) {
		throw new Error(`Last.fm request failed with status ${response.status}`);
	}

	const data = await response.json();
	if (data.error) {
		throw new Error(data.message || `Last.fm error ${data.error}`);
	}

	return data;
}

async function FetchTrackDurationSeconds(artist, track) {
	try {
		const data = await FetchLastFm("track.getInfo", {
			artist,
			track,
			username,
			autocorrect: "1"
		});

		const durationMs = Number(data?.track?.duration || 0);
		return Number.isFinite(durationMs) && durationMs > 0 ? durationMs / 1000 : 0;
	} catch (error) {
		console.debug("Unable to fetch track duration", error);
		return 0;
	}
}

function GetBestTrackImage(images) {
	if (!Array.isArray(images)) {
		return "images/placeholder-album-art.png";
	}

	const preferredSizes = ["extralarge", "large", "medium", "small"];
	for (const size of preferredSizes) {
		const match = images.find((img) => img.size === size && img["#text"]);
		if (match) {
			return match["#text"];
		}
	}

	const anyImage = images.find((img) => img["#text"]);
	return anyImage ? anyImage["#text"] : "images/placeholder-album-art.png";
}

async function GetNowPlayingData() {
	const data = await FetchLastFm("user.getrecenttracks", {
		user: username,
		limit: "1",
		extended: "1"
	});

	const rawTrack = data?.recenttracks?.track;
	const track = Array.isArray(rawTrack) ? rawTrack[0] : rawTrack;
	if (!track) {
		return { isPlaying: false };
	}

	const isPlaying = track?.["@attr"]?.nowplaying === "true";
	const artist = track?.artist?.name || track?.artist?.["#text"] || "Unknown Artist";
	const name = track?.name || "Unknown Track";
	const albumArt = GetBestTrackImage(track?.image);
	const trackId = `${artist}::${name}`;

	let durationSeconds = 0;
	if (isPlaying) {
		durationSeconds = await FetchTrackDurationSeconds(artist, name);
	}

	return {
		isPlaying,
		trackId,
		artist,
		name,
		albumArt,
		durationSeconds
	};
}

function SchedulePoll(delay = POLL_INTERVAL_MS) {
	if (pollTimeoutId) {
		clearTimeout(pollTimeoutId);
	}

	pollTimeoutId = setTimeout(PollNowPlaying, delay);
}

async function PollNowPlaying() {
	try {
		HideStatus();
		const nowPlayingData = await GetNowPlayingData();
		UpdatePlayer(nowPlayingData);
		SchedulePoll(POLL_INTERVAL_MS);
	} catch (error) {
		console.error(error);
		ShowStatus("Could not fetch Last.fm data. Retrying...");
		SetVisibility(false);
		SchedulePoll(3000);
	}
}

function TriggerPlayerVisibility() {
	setTimeout(() => {
		SetVisibility(true);

		if (visibilityDuration > 0) {
			setTimeout(() => {
				SetVisibility(false, false);
			}, visibilityDuration * 1000);
		}
	}, 500);
}

function UpdateProgressDisplay() {
	if (currentDurationSeconds > 0) {
		const progressSeconds = Math.max(0, (Date.now() - trackStartedAtMs) / 1000);
		const clampedProgress = Math.min(progressSeconds, currentDurationSeconds);
		const progressPerc = (clampedProgress / currentDurationSeconds) * 100;

		document.getElementById("progressBar").style.width = `${progressPerc}%`;
		document.getElementById("progressTime").innerHTML = ConvertSecondsToMinutesSoThatItLooksBetterOnTheOverlay(clampedProgress);
		document.getElementById("timeRemaining").innerHTML = `-${ConvertSecondsToMinutesSoThatItLooksBetterOnTheOverlay(currentDurationSeconds - clampedProgress)}`;
	} else {
		document.getElementById("progressBar").style.width = "0%";
		document.getElementById("progressTime").innerHTML = "--:--";
		document.getElementById("timeRemaining").innerHTML = "--:--";
	}
}

function UpdatePlayer(data) {
	if (!data.isPlaying) {
		SetVisibility(false);
		return;
	}

	if (!currentState || data.trackId !== currentTrackId) {
		TriggerPlayerVisibility();
	}

	if (data.trackId !== currentTrackId) {
		currentTrackId = data.trackId;
		currentDurationSeconds = Number(data.durationSeconds || 0);
		trackStartedAtMs = Date.now();

		UpdateAlbumArt(document.getElementById("albumArt"), data.albumArt);
		UpdateAlbumArt(document.getElementById("backgroundImage"), data.albumArt);
		UpdateTextLabel(document.getElementById("artistLabel"), data.artist);
		UpdateTextLabel(document.getElementById("songLabel"), data.name);

		setTimeout(() => {
			document.getElementById("albumArtBack").src = data.albumArt;
			document.getElementById("backgroundImageBack").src = data.albumArt;
		}, 1000);
	}

	UpdateProgressDisplay();
}

function ShowStatus(text) {
	const statusContainer = document.getElementById("statusContainer");
	statusContainer.innerText = text;
	statusContainer.style.opacity = 1;
}

function HideStatus() {
	document.getElementById("statusContainer").style.opacity = 0;
}

function UpdateTextLabel(div, text) {
	if (div.innerText !== text) {
		div.setAttribute("class", "text-fade");
		setTimeout(() => {
			div.innerText = text;
			div.setAttribute("class", "text-show");
		}, 500);
	}
}

function UpdateAlbumArt(div, imgsrc) {
	if (div.src !== imgsrc) {
		div.setAttribute("class", "text-fade");
		setTimeout(() => {
			div.src = imgsrc;
			div.setAttribute("class", "text-show");
		}, 500);
	}
}

//////////////////////
// HELPER FUNCTIONS //
//////////////////////

function ConvertSecondsToMinutesSoThatItLooksBetterOnTheOverlay(time) {
	const normalizedTime = Math.max(0, Number(time) || 0);
	const minutes = Math.floor(normalizedTime / 60);
	const seconds = Math.trunc(normalizedTime - minutes * 60);
	return `${minutes}:${("0" + seconds).slice(-2)}`;
}

function SetVisibility(isVisible, updateCurrentState = true) {
	widgetVisibility = isVisible;
	const mainContainer = document.getElementById("mainContainer");

	if (isVisible) {
		mainContainer.style.opacity = 1;
		mainContainer.style.bottom = "50%";
	} else {
		mainContainer.style.opacity = 0;
		mainContainer.style.bottom = "calc(50% - 20px)";
	}

	if (updateCurrentState) {
		currentState = isVisible;
	}
}

//////////////////////////////////////////////////////////////////////////////////////////
// RESIZER THING BECAUSE I THINK I KNOW HOW RESPONSIVE DESIGN WORKS EVEN THOUGH I DON'T //
//////////////////////////////////////////////////////////////////////////////////////////

let outer = document.getElementById("mainContainer");
let maxWidth = outer.clientWidth + 50;

window.addEventListener("resize", resize);

resize();
function resize() {
	const scale = window.innerWidth / maxWidth;
	outer.style.transform = "translate(-50%, 50%) scale(" + scale + ")";
}

/////////////////////////////////////////////////////////////////////
// IF THE USER PUT IN THE HIDEALBUMART PARAMATER, THEN YOU SHOULD  //
//   HIDE THE ALBUM ART, BECAUSE THAT'S WHAT IT'S SUPPOSED TO DO   //
/////////////////////////////////////////////////////////////////////

if (hideAlbumArt) {
	document.getElementById("albumArtBox").style.display = "none";
	document.getElementById("songInfoBox").style.width = "calc(100% - 20px)";
}

////////////////////////////////
// KICK OFF THE WHOLE WIDGET  //
////////////////////////////////

if (!apiKey || !username) {
	window.location.href = BuildConfigureUrl();
} else {
	PollNowPlaying();
	setInterval(UpdateProgressDisplay, 1000);
}