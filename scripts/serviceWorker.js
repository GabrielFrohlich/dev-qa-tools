const STORAGE_KEY = 'dqt_enabled';

async function getEnabled(){
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      resolve(res[STORAGE_KEY] !== false); // default ON
    });
  });
}

async function setEnabled(val){
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: !!val }, () => resolve());
  });
}

async function updateBadge(){
  const enabled = await getEnabled();
  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({ color: enabled ? '#0ea5e9' : '#9ca3af' });
}

chrome.runtime.onInstalled.addListener(async () => {
  await updateBadge();
});

chrome.action.onClicked.addListener(async () => {
  const enabled = await getEnabled();
  await setEnabled(!enabled);
  await updateBadge();
  // Notify all tabs so content script can react
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'DQT_TOGGLE', enabled: !enabled }).catch(() => {});
      }
    }
  });
});

// Allow popup to query and set enabled state
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'DQT_GET_ENABLED') {
    getEnabled().then((val) => sendResponse({ enabled: val }));
    return true; // async
  }
  if (msg?.type === 'DQT_SET_ENABLED') {
    const next = !!msg.enabled;
    (async () => {
      await setEnabled(next);
      await updateBadge();
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'DQT_TOGGLE', enabled: next }).catch(() => {});
          }
        }
      });
      sendResponse({ ok: true });
    })();
    return true; // async
  }
});
