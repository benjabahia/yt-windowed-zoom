const DEFAULTS = {
  windowedFullscreen: true,
  zoomEnabled: true,
  zoomOnlyInFullscreen: true,
  zoomSpeed: 1,
  maxZoom: 8,
};

const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(DEFAULTS, (s) => {
  $('windowedFullscreen').checked = s.windowedFullscreen;
  $('zoomEnabled').checked = s.zoomEnabled;
  $('zoomOnlyInFullscreen').checked = s.zoomOnlyInFullscreen;
  $('zoomSpeed').value = s.zoomSpeed;
  $('maxZoom').value = String(s.maxZoom);
  updateDisabled();
});

function updateDisabled() {
  const on = $('zoomEnabled').checked;
  for (const id of ['zoomOnlyInFullscreen', 'zoomSpeed', 'maxZoom']) $(id).disabled = !on;
}

for (const id of ['windowedFullscreen', 'zoomEnabled', 'zoomOnlyInFullscreen']) {
  $(id).addEventListener('change', () => {
    chrome.storage.sync.set({ [id]: $(id).checked });
    updateDisabled();
  });
}
$('zoomSpeed').addEventListener('input', () =>
  chrome.storage.sync.set({ zoomSpeed: parseFloat($('zoomSpeed').value) }));
$('maxZoom').addEventListener('change', () =>
  chrome.storage.sync.set({ maxZoom: parseFloat($('maxZoom').value) }));
