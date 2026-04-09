///////////////
// PARAMETERS //
///////////////

const apiKeyBox = document.getElementById("api_key_box");
const usernameBox = document.getElementById("username_box");
const durationBox = document.getElementById("duration_box");
const hideAlbumArtBox = document.getElementById("hide_album_art_box");
const launchButton = document.getElementById("launchButton");

function checkInputs() {
    const hasApiKey = apiKeyBox.value.trim() !== "";
    const hasUsername = usernameBox.value.trim() !== "";
    launchButton.disabled = !(hasApiKey && hasUsername);
}

apiKeyBox.addEventListener("input", checkInputs);
usernameBox.addEventListener("input", checkInputs);
checkInputs();

apiKeyBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !launchButton.disabled) {
        LaunchWidget();
    }
});

function getBaseWidgetUrl() {
    const path = window.location.pathname
        .replace(/\/configure\/index\.html$/, "/")
        .replace(/\/configure\/$/, "/")
        .replace(/\/configure$/, "/")
        .replace(/\/+$/, "/");
    return `${window.location.origin}${path}`;
}

function LaunchWidget() {
    const apiKey = apiKeyBox.value.trim();
    const username = usernameBox.value.trim();
    const durationValue = durationBox.value.trim();
    const duration = Number(durationValue);

    if (!apiKey || !username) {
        return;
    }

    const baseURL = getBaseWidgetUrl();
    const params = new URLSearchParams({
        apikey: apiKey,
        username
    });

    if (durationValue !== "" && Number.isFinite(duration) && duration > 0) {
        params.set("duration", String(Math.floor(duration)));
    }

    if (hideAlbumArtBox.checked) {
        params.set("hideAlbumArt", "");
    }

    const targetUrl = `${baseURL}?${params.toString()}`;
    window.location.href = targetUrl;
}

function OpenInstructions() {
    window.open("https://www.last.fm/api/account/create", "_blank").focus();
}

usernameBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !launchButton.disabled) {
        LaunchWidget();
    }
});

durationBox.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !launchButton.disabled) {
        LaunchWidget();
    }
});

document.querySelectorAll(".guide-copy-trigger").forEach((btn) => {
    btn.addEventListener("click", async () => {
        const text = btn.getAttribute("data-copy") || btn.textContent.trim();
        if (!text) return;
        const prev = btn.textContent;
        try {
            await navigator.clipboard.writeText(text);
            btn.classList.add("is-copied");
            btn.textContent = "Copied";
            setTimeout(() => {
                btn.textContent = prev;
                btn.classList.remove("is-copied");
            }, 1200);
        } catch (_) {
            btn.textContent = "Couldn't copy";
            setTimeout(() => {
                btn.textContent = prev;
            }, 1200);
        }
    });
});
